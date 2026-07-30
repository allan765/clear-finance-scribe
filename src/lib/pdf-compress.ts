// Rasterização/compressão de PDFs de comprovantes para reduzir o tamanho final
// do arquivo consolidado da prestação de contas.
import { PDFDocument } from "pdf-lib";

// Navegadores um pouco mais antigos não têm Map.prototype.getOrInsertComputed,
// exigido pelo pdf.js — sem isso a compressão dos comprovantes falha.
function polyfillMapHelpers() {
  const proto = Map.prototype as unknown as Record<string, unknown>;
  if (typeof proto.getOrInsertComputed !== "function") {
    Object.defineProperty(proto, "getOrInsertComputed", {
      configurable: true,
      writable: true,
      value: function (this: Map<unknown, unknown>, key: unknown, fn: (k: unknown) => unknown) {
        if (!this.has(key)) this.set(key, fn(key));
        return this.get(key);
      },
    });
  }
  if (typeof proto.getOrInsert !== "function") {
    Object.defineProperty(proto, "getOrInsert", {
      configurable: true,
      writable: true,
      value: function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
        if (!this.has(key)) this.set(key, value);
        return this.get(key);
      },
    });
  }
}

polyfillMapHelpers();

async function loadPdfJs() {
  polyfillMapHelpers();
  const pdfjsLib = await import("pdfjs-dist");
  const pdfWorker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  return pdfjsLib;
}



async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
  if (!blob) throw new Error("Falha ao converter página em JPEG");
  return new Uint8Array(await blob.arrayBuffer());
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

  // Um único canvas reaproveitado: evita estourar a memória em documentos longos.
  const canvas = document.createElement("canvas");
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      // fundo branco (JPEG não tem transparência)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const jpeg = await canvasToJpegBytes(canvas, quality);
      const img = await out.embedJpg(jpeg);
      const p = out.addPage([base.width, base.height]);
      p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
      // devolve o controle ao navegador para liberar memória entre páginas
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    await pdf.cleanup();
    await pdf.destroy();
  }
}


export const COMPRESSION_TIERS: { scale: number; quality: number }[] = [
  { scale: 1.15, quality: 0.6 },
  { scale: 1.0, quality: 0.5 },
  { scale: 0.85, quality: 0.42 },
  { scale: 0.7, quality: 0.35 },
  { scale: 0.6, quality: 0.3 },
];
