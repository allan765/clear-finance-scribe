// Helpers de extração client-side antes de enviar para a IA
import * as pdfjsLib from "pdfjs-dist";
// Worker como módulo (Vite resolve)
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    parts.push(`--- Página ${i} ---\n${text}`);
  }
  return parts.join("\n\n");
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
  | { kind: "image"; imageDataUrl: string; filename: string };

export async function preparePayload(file: File): Promise<PreparedPayload> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const text = await extractPdfText(file);
    return { kind: "text", text, filename: file.name };
  }
  if (type.startsWith("image/")) {
    const url = await fileToDataUrl(file);
    return { kind: "image", imageDataUrl: url, filename: file.name };
  }
  // CSV, OFX, TXT, QIF, etc.
  const text = await fileToText(file);
  return { kind: "text", text, filename: file.name };
}
