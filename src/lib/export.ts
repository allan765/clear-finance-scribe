import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { Entry, Month, Settings } from "./data";
import { computeRunningBalances } from "./data";
import { labelOf } from "./classifications";
import { formatDateBR, formatNumber, monthLabel } from "./format";

type MonthData = {
  month: Month;
  entries: Entry[];
  opening: number;
};

const TITLE_FONT = "helvetica";

function header(doc: jsPDF, settings: Settings, subtitle: string) {
  doc.setFont(TITLE_FONT, "bold");
  doc.setFontSize(13);
  doc.text("PRESTAÇÃO DE CONTAS", doc.internal.pageSize.getWidth() / 2, 40, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.text(settings.identification, doc.internal.pageSize.getWidth() / 2, 58, {
    align: "center",
  });
  doc.setFont(TITLE_FONT, "normal");
  doc.setFontSize(10);
  doc.text(subtitle, doc.internal.pageSize.getWidth() / 2, 74, { align: "center" });
}

function footerPage(doc: jsPDF, settings: Settings) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont(TITLE_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(settings.responsible, 40, h - 20);
    doc.text(`Página ${i} de ${pageCount}`, w - 40, h - 20, { align: "right" });
    doc.setTextColor(0);
  }
}

function tableForMonth(doc: jsPDF, md: MonthData, startY: number) {
  const rows = computeRunningBalances(md.entries, md.opening);
  const body = [
    [
      "-",
      `01/${String(md.month.month).padStart(2, "0")}/${String(md.month.year).slice(2)}`,
      "Saldo anterior",
      "-",
      "-",
      "-",
      formatNumber(md.opening),
    ],
    ...rows.map((e) => [
      String(e.doc_number),
      formatDateBR(e.entry_date),
      e.description || "-",
      labelOf(e.classification),
      formatNumber(Number(e.credit)),
      formatNumber(Number(e.debit)),
      formatNumber(e.balance),
    ]),
  ];

  const totalC = md.entries.reduce((s, e) => s + Number(e.credit), 0);
  const totalD = md.entries.reduce((s, e) => s + Number(e.debit), 0);
  const finalBalance = md.opening + totalC - totalD;

  autoTable(doc, {
    startY,
    head: [["N.º Doc.", "Data", "Descrição do Documento", "Classificação", "Recebimentos (Créditos)", "Desembolsos (Débitos)", "Saldo"]],
    body,
    foot: [[
      { content: `Total do mês de ${monthLabel(md.month.reference).toLowerCase()}`, colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(totalC), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(totalD), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(finalBalance), styles: { halign: "right", fontStyle: "bold" } },
    ]],
    theme: "grid",
    styles: { font: TITLE_FONT, fontSize: 8.5, cellPadding: 4, lineColor: [120, 120, 120] },
    headStyles: { fillColor: [40, 60, 110], textColor: 255, halign: "center" },
    footStyles: { fillColor: [235, 238, 245], textColor: 30 },
    columnStyles: {
      0: { halign: "center", cellWidth: 40 },
      1: { halign: "center", cellWidth: 55 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 95 },
      4: { halign: "right", cellWidth: 75 },
      5: { halign: "right", cellWidth: 75 },
      6: { halign: "right", cellWidth: 75 },
    },
    margin: { left: 30, right: 30 },
  });

  return finalBalance;
}

export function exportMonthPDF(md: MonthData, settings: Settings) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  header(doc, settings, `Mês de referência: ${monthLabel(md.month.reference)}`);
  tableForMonth(doc, md, 95);

  if (md.month.notes) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
    doc.setFont(TITLE_FONT, "bold");
    doc.setFontSize(10);
    doc.text("Observações do mês:", 30, y);
    doc.setFont(TITLE_FONT, "normal");
    doc.text(doc.splitTextToSize(md.month.notes, doc.internal.pageSize.getWidth() - 60), 30, y + 14);
  }

  footerPage(doc, settings);
  doc.save(`prestacao-${md.month.reference}.pdf`);
}

export function exportFullPDF(months: MonthData[], settings: Settings) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // CAPA
  doc.setFillColor(40, 60, 110);
  doc.rect(0, 0, w, 140, "F");
  doc.setTextColor(255);
  doc.setFont(TITLE_FONT, "bold");
  doc.setFontSize(22);
  doc.text("PRESTAÇÃO DE CONTAS", w / 2, 70, { align: "center" });
  doc.setFontSize(12);
  doc.setFont(TITLE_FONT, "normal");
  doc.text("Documento Oficial — Modelo Ministério Público", w / 2, 95, { align: "center" });

  doc.setTextColor(20);
  doc.setFont(TITLE_FONT, "bold");
  doc.setFontSize(16);
  doc.text(settings.identification, w / 2, 220, { align: "center" });

  doc.setFont(TITLE_FONT, "normal");
  doc.setFontSize(12);
  const periodo = `Período: ${monthLabel(settings.period_start)} a ${monthLabel(settings.period_end)}`;
  doc.text(periodo, w / 2, 250, { align: "center" });

  // Resumo na capa
  const totalC = months.reduce((s, m) => s + m.entries.reduce((a, e) => a + Number(e.credit), 0), 0);
  const totalD = months.reduce((s, m) => s + m.entries.reduce((a, e) => a + Number(e.debit), 0), 0);
  const opening = months[0]?.opening ?? 0;
  const finalBalance = opening + totalC - totalD;

  autoTable(doc, {
    startY: 320,
    head: [["Resumo Geral", "Valor (R$)"]],
    body: [
      ["Saldo inicial", formatNumber(opening)],
      ["Total de receitas (créditos)", formatNumber(totalC)],
      ["Total de despesas (débitos)", formatNumber(totalD)],
      ["Saldo final", formatNumber(finalBalance)],
    ],
    theme: "grid",
    styles: { font: TITLE_FONT, fontSize: 11, cellPadding: 8 },
    headStyles: { fillColor: [40, 60, 110], textColor: 255 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 80, right: 80 },
  });

  // Responsável
  doc.setFontSize(10);
  doc.text("Responsável pela prestação de contas:", 80, h - 160);
  doc.setFont(TITLE_FONT, "bold");
  doc.text(settings.responsible, 80, h - 142);
  doc.setFont(TITLE_FONT, "normal");
  doc.line(80, h - 90, w - 80, h - 90);
  doc.text("Assinatura", w / 2, h - 76, { align: "center" });
  doc.text(`Brasília, ${new Date().toLocaleDateString("pt-BR")}`, w / 2, h - 60, { align: "center" });

  // Páginas por mês (landscape pages)
  for (const md of months) {
    doc.addPage("a4", "landscape");
    header(doc, settings, `Mês de referência: ${monthLabel(md.month.reference)}`);
    tableForMonth(doc, md, 95);
  }

  // Página final consolidada
  doc.addPage("a4", "portrait");
  header(doc, settings, "Resumo Consolidado do Período");
  autoTable(doc, {
    startY: 110,
    head: [["Mês", "Receitas (R$)", "Despesas (R$)", "Saldo do Mês (R$)", "Saldo Acumulado (R$)"]],
    body: (() => {
      let acc = opening;
      return months.map((m) => {
        const c = m.entries.reduce((s, e) => s + Number(e.credit), 0);
        const d = m.entries.reduce((s, e) => s + Number(e.debit), 0);
        acc = acc + c - d;
        return [monthLabel(m.month.reference), formatNumber(c), formatNumber(d), formatNumber(c - d), formatNumber(acc)];
      });
    })(),
    foot: [[
      { content: "TOTAIS", styles: { fontStyle: "bold" } },
      { content: formatNumber(totalC), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(totalD), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(totalC - totalD), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(finalBalance), styles: { halign: "right", fontStyle: "bold" } },
    ]],
    theme: "grid",
    styles: { font: TITLE_FONT, fontSize: 9.5, cellPadding: 5 },
    headStyles: { fillColor: [40, 60, 110], textColor: 255, halign: "center" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  footerPage(doc, settings);
  doc.save(`prestacao-completa-${settings.period_start}_${settings.period_end}.pdf`);
}

export function exportExcel(months: MonthData[], settings: Settings) {
  const wb = XLSX.utils.book_new();

  // Aba consolidada
  let acc = months[0]?.opening ?? 0;
  const consolidated: (string | number)[][] = [
    ["Prestação de Contas", settings.identification],
    ["Responsável", settings.responsible],
    ["Período", `${monthLabel(settings.period_start)} a ${monthLabel(settings.period_end)}`],
    [],
    ["Mês", "Receitas", "Despesas", "Saldo do Mês", "Saldo Acumulado"],
  ];
  for (const m of months) {
    const c = m.entries.reduce((s, e) => s + Number(e.credit), 0);
    const d = m.entries.reduce((s, e) => s + Number(e.debit), 0);
    acc = acc + c - d;
    consolidated.push([monthLabel(m.month.reference), c, d, c - d, acc]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(consolidated), "Resumo");

  // Abas por mês
  for (const md of months) {
    const rows: (string | number)[][] = [
      ["N.º Doc.", "Data", "Descrição", "Classificação", "Créditos", "Débitos", "Saldo"],
      ["-", `01/${String(md.month.month).padStart(2, "0")}/${md.month.year}`, "Saldo anterior", "-", 0, 0, md.opening],
    ];
    let r = md.opening;
    for (const e of md.entries) {
      r = r + Number(e.credit) - Number(e.debit);
      rows.push([
        e.doc_number,
        formatDateBR(e.entry_date),
        e.description,
        labelOf(e.classification),
        Number(e.credit),
        Number(e.debit),
        r,
      ]);
    }
    const totalC = md.entries.reduce((s, e) => s + Number(e.credit), 0);
    const totalD = md.entries.reduce((s, e) => s + Number(e.debit), 0);
    rows.push(["", "", `Total ${monthLabel(md.month.reference)}`, "", totalC, totalD, md.opening + totalC - totalD]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, md.month.reference);
  }

  XLSX.writeFile(wb, `prestacao-${settings.period_start}_${settings.period_end}.xlsx`);
}
