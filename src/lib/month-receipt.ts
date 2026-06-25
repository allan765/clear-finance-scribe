import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument } from "pdf-lib";
import type { Entry, Month, Settings } from "./data";
import { computeRunningBalances } from "./data";
import { labelOf } from "./classifications";
import { formatDateBR, formatNumber, monthLabel } from "./format";

function buildCover(md: { month: Month; entries: Entry[]; opening: number }, settings: Settings): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Capa
  doc.setFillColor(40, 60, 110);
  doc.rect(0, 0, w, 130, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("PRESTAÇÃO DE CONTAS", w / 2, 60, { align: "center" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Comprovantes e Recibos do Mês", w / 2, 85, { align: "center" });
  doc.setFontSize(11);
  doc.text(settings.identification, w / 2, 108, { align: "center" });

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(monthLabel(md.month.reference), w / 2, 180, { align: "center" });

  const totalC = md.entries.reduce((s, e) => s + Number(e.credit), 0);
  const totalD = md.entries.reduce((s, e) => s + Number(e.debit), 0);
  const finalBalance = md.opening + totalC - totalD;

  autoTable(doc, {
    startY: 220,
    head: [["Resumo do mês", "Valor (R$)"]],
    body: [
      ["Saldo anterior", formatNumber(md.opening)],
      ["Total de receitas (créditos)", formatNumber(totalC)],
      ["Total de despesas (débitos)", formatNumber(totalD)],
      ["Saldo final", formatNumber(finalBalance)],
      ["Quantidade de lançamentos", String(md.entries.length)],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 11, cellPadding: 7 },
    headStyles: { fillColor: [40, 60, 110], textColor: 255 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 80, right: 80 },
  });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    "As páginas seguintes contêm os comprovantes/recibos digitalizados que sustentam os lançamentos deste mês.",
    w / 2,
    h - 130,
    { align: "center", maxWidth: w - 120 },
  );
  doc.setFont("helvetica", "bold");
  doc.text("Responsável:", 80, h - 90);
  doc.setFont("helvetica", "normal");
  doc.text(settings.responsible, 80, h - 74);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, w - 80, h - 40, { align: "right" });

  // Página com a planilha resumida do mês
  doc.addPage("a4", "landscape");
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Planilha — ${monthLabel(md.month.reference)}`, doc.internal.pageSize.getWidth() / 2, 40, { align: "center" });
  const rows = computeRunningBalances(md.entries, md.opening);
  autoTable(doc, {
    startY: 60,
    head: [["N.º Doc.", "Data", "Descrição", "Classificação", "Créditos", "Débitos", "Saldo"]],
    body: [
      ["-", `01/${String(md.month.month).padStart(2, "0")}/${String(md.month.year).slice(2)}`, "Saldo anterior", "-", "-", "-", formatNumber(md.opening)],
      ...rows.map((e) => [
        String(e.doc_number),
        formatDateBR(e.entry_date),
        e.description || "-",
        labelOf(e.classification),
        formatNumber(Number(e.credit)),
        formatNumber(Number(e.debit)),
        formatNumber(e.balance),
      ]),
    ],
    foot: [[
      { content: `Total ${monthLabel(md.month.reference).toLowerCase()}`, colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(totalC), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(totalD), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(finalBalance), styles: { halign: "right", fontStyle: "bold" } },
    ]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [40, 60, 110], textColor: 255, halign: "center" },
    margin: { left: 30, right: 30 },
  });

  const ab = doc.output("arraybuffer");
  return new Uint8Array(ab);
}

export async function downloadMonthCoverWithReceipts(
  md: { month: Month; entries: Entry[]; opening: number },
  settings: Settings,
  receiptUrl: string | null | undefined,
) {
  const coverBytes = buildCover(md, settings);
  const outDoc = await PDFDocument.create();
  const cover = await PDFDocument.load(coverBytes);
  const coverPages = await outDoc.copyPages(cover, cover.getPageIndices());
  coverPages.forEach((p) => outDoc.addPage(p));

  if (receiptUrl) {
    try {
      const resp = await fetch(receiptUrl);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const src = await PDFDocument.load(buf);
        const pages = await outDoc.copyPages(src, src.getPageIndices());
        pages.forEach((p) => outDoc.addPage(p));
      }
    } catch (e) {
      console.warn("Falha ao mesclar PDF de comprovantes", e);
    }
  }

  const bytes = await outDoc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comprovantes-${md.month.reference}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
