// Helpers de extração client-side antes de enviar para a IA

async function loadPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  const pdfWorker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  return pdfjsLib;
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: unknown) => {
        const item = it as { str?: string };
        return item.str ?? "";
      })
      .join(" ");
    parts.push(`--- Página ${i} ---\n${text}`);
  }
  return parts.join("\n\n");
}

// Renderiza cada página do PDF como imagem (data URL) — usado quando o
// extrato é digitalizado/escaneado e o texto extraído é insuficiente.
export async function renderPdfPagesToImages(
  file: File,
  opts: { scale?: number; maxPages?: number } = {}
): Promise<string[]> {
  const scale = opts.scale ?? 2;
  const maxPages = opts.maxPages ?? 10;
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.85));
  }
  return images;
}

export async function fileToText(file: File): Promise<string> {
  return await file.text();
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export type PreparedPayload =
  | { kind: "text"; text: string; filename: string }
  | { kind: "image"; imageDataUrl: string; filename: string }
  | { kind: "images"; imageDataUrls: string[]; filename: string };

// Heurística: texto curto demais para um extrato real → PDF escaneado.
const MIN_USEFUL_TEXT_LEN = 400;

export async function preparePayload(file: File): Promise<PreparedPayload> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const text = await extractPdfText(file);
    const stripped = text.replace(/---\s*Página\s*\d+\s*---/g, "").trim();
    if (stripped.length >= MIN_USEFUL_TEXT_LEN) {
      return { kind: "text", text, filename: file.name };
    }
    // PDF escaneado / pouca extração de texto → renderiza páginas como imagem
    const images = await renderPdfPagesToImages(file, { scale: 2, maxPages: 10 });
    if (images.length === 0) {
      return { kind: "text", text, filename: file.name };
    }
    return { kind: "images", imageDataUrls: images, filename: file.name };
  }
  if (type.startsWith("image/")) {
    const url = await fileToDataUrl(file);
    return { kind: "image", imageDataUrl: url, filename: file.name };
  }
  // CSV, OFX, TXT, QIF, etc.
  const text = await fileToText(file);
  return { kind: "text", text, filename: file.name };
}
