// Rasterização/compressão de PDFs de comprovantes para reduzir o tamanho final
// do arquivo consolidado da prestação de contas.
import { PDFDocument } from "pdf-lib";

async function loadPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  const pdfWorker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  return pdfjsLib;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Converte cada página de um PDF em JPEG comprimido e adiciona ao documento de saída,
 * preservando o tamanho original da página. Reduz drasticamente PDFs digitalizados.
 */
export async function appendPdfAsCompressedImages(
  out: PDFDocument,
  buf: ArrayBuffer,
  opts: { scale?: number; quality?: number } = {},
) {
  const scale = opts.scale ?? 1.15;
  const quality = opts.quality ?? 0.6;
  const pdfjsLib = await loadPdfJs();
  // pdf.js consome o buffer; usa uma cópia para permitir reuso
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    // fundo branco (JPEG não tem transparência)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const jpeg = dataUrlToBytes(canvas.toDataURL("image/jpeg", quality));
    const img = await out.embedJpg(jpeg);
    const p = out.addPage([base.width, base.height]);
    p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    canvas.width = 0;
    canvas.height = 0;
  }
}

export const COMPRESSION_TIERS: { scale: number; quality: number }[] = [
  { scale: 1.15, quality: 0.6 },
  { scale: 1.0, quality: 0.5 },
  { scale: 0.85, quality: 0.42 },
  { scale: 0.7, quality: 0.35 },
  { scale: 0.6, quality: 0.3 },
];
