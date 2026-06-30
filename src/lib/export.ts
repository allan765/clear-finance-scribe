import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { PDFDocument } from "pdf-lib";
import type { Entry, Month, Settings } from "./data";
import { computeRunningBalances } from "./data";
import { labelOf } from "./classifications";
import { formatDateBR, formatNumber, monthLabel } from "./format";

type MonthData = {
  month: Month;
  entries: Entry[];
  opening: number;
  receiptUrl?: string | null;
};

const TITLE_FONT = "helvetica";
const BRAND: [number, number, number] = [40, 60, 110];
const BRAND_LIGHT: [number, number, number] = [235, 238, 245];

function header(doc: jsPDF, settings: Settings, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 30, "F");
  doc.setTextColor(255);
  doc.setFont(TITLE_FONT, "bold");
  doc.setFontSize(11);
  doc.text("PRESTAÇÃO DE CONTAS", 30, 19);
  doc.setFont(TITLE_FONT, "normal");
  doc.setFontSize(9);
  doc.text(settings.identification, w - 30, 19, { align: "right" });

  doc.setTextColor(20);
  doc.setFont(TITLE_FONT, "bold");
  doc.setFontSize(12);
  doc.text(subtitle, w / 2, 55, { align: "center" });
}

function footerPage(doc: jsPDF, settings: Settings) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(180);
    doc.line(30, h - 28, w - 30, h - 28);
    doc.setFont(TITLE_FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(settings.responsible, 30, h - 16);
    doc.text(`Página ${i} de ${pageCount}`, w - 30, h - 16, { align: "right" });
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
    headStyles: { fillColor: BRAND, textColor: 255, halign: "center" },
    footStyles: { fillColor: BRAND_LIGHT, textColor: 30 },
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
  tableForMonth(doc, md, 75);

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

/**
 * Build the cover, summary, per-month sections (cover + planilha) and closing pages.
 * Returns the jsPDF bytes for further merging with attached receipts.
 */
function buildReportPDF(months: MonthData[], settings: Settings, opts: { withMonthSeparators?: boolean } = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // ─── CAPA GERAL ────────────────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, h, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(40, 40, w - 80, h - 80, "F");

  doc.setFillColor(...BRAND);
  doc.rect(40, 40, w - 80, 110, "F");
  doc.setTextColor(255);
  doc.setFont(TITLE_FONT, "bold");
  doc.setFontSize(24);
  doc.text("PRESTAÇÃO DE CONTAS", w / 2, 95, { align: "center" });
  doc.setFontSize(12);
  doc.setFont(TITLE_FONT, "normal");
  doc.text("Documento Oficial — Modelo Ministério Público", w / 2, 122, { align: "center" });

  doc.setTextColor(20);
  doc.setFont(TITLE_FONT, "bold");
  doc.setFontSize(18);
  doc.text(settings.identification, w / 2, 230, { align: "center" });

  doc.setFont(TITLE_FONT, "normal");
  doc.setFontSize(13);
  doc.text(
    `Período: ${monthLabel(settings.period_start)} a ${monthLabel(settings.period_end)}`,
    w / 2,
    258,
    { align: "center" },
  );

  // Resumo da capa
  const totalC = months.reduce((s, m) => s + m.entries.reduce((a, e) => a + Number(e.credit), 0), 0);
  const totalD = months.reduce((s, m) => s + m.entries.reduce((a, e) => a + Number(e.debit), 0), 0);
  const opening = months[0]?.opening ?? 0;
  const finalBalance = opening + totalC - totalD;
  const totalEntries = months.reduce((s, m) => s + m.entries.length, 0);
  const totalUnclassified = months.reduce(
    (s, m) => s + m.entries.filter((e) => e.classification === "nao_classificado").length,
    0,
  );

  autoTable(doc, {
    startY: 310,
    head: [["Resumo Geral", "Valor / Quantidade"]],
    body: [
      ["Saldo inicial do período", `R$ ${formatNumber(opening)}`],
      ["Total de receitas (créditos)", `R$ ${formatNumber(totalC)}`],
      ["Total de despesas (débitos)", `R$ ${formatNumber(totalD)}`],
      ["Saldo final do período", `R$ ${formatNumber(finalBalance)}`],
      ["Quantidade de meses", String(months.length)],
      ["Quantidade total de lançamentos", String(totalEntries)],
      ["Lançamentos sem classificação", String(totalUnclassified)],
    ],
    theme: "grid",
    styles: { font: TITLE_FONT, fontSize: 11, cellPadding: 7 },
    headStyles: { fillColor: BRAND, textColor: 255 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 90, right: 90 },
  });

  // Rodapé da capa
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text("Responsável pela prestação de contas:", 90, h - 170);
  doc.setFont(TITLE_FONT, "bold");
  doc.text(settings.responsible, 90, h - 152);
  doc.setFont(TITLE_FONT, "normal");
  doc.setDrawColor(120);
  doc.line(90, h - 100, w - 90, h - 100);
  doc.text("Assinatura do responsável", w / 2, h - 86, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Brasília, ${new Date().toLocaleDateString("pt-BR")}`, w / 2, h - 68, { align: "center" });

  // ─── PÁGINA: RESUMO MENSAL ─────────────────────────────────
  doc.addPage("a4", "portrait");
  header(doc, settings, "Resumo Mensal do Período");

  let acc = opening;
  const monthlyRows = months.map((m) => {
    const c = m.entries.reduce((s, e) => s + Number(e.credit), 0);
    const d = m.entries.reduce((s, e) => s + Number(e.debit), 0);
    acc = acc + c - d;
    return [
      monthLabel(m.month.reference),
      String(m.entries.length),
      formatNumber(c),
      formatNumber(d),
      formatNumber(c - d),
      formatNumber(acc),
    ];
  });

  autoTable(doc, {
    startY: 80,
    head: [["Mês", "Lanç.", "Receitas (R$)", "Despesas (R$)", "Saldo do Mês", "Saldo Acumulado"]],
    body: monthlyRows,
    foot: [[
      { content: "TOTAIS", styles: { fontStyle: "bold" } },
      { content: String(totalEntries), styles: { halign: "center", fontStyle: "bold" } },
      { content: formatNumber(totalC), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(totalD), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(totalC - totalD), styles: { halign: "right", fontStyle: "bold" } },
      { content: formatNumber(finalBalance), styles: { halign: "right", fontStyle: "bold" } },
    ]],
    theme: "grid",
    styles: { font: TITLE_FONT, fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: BRAND, textColor: 255, halign: "center" },
    footStyles: { fillColor: BRAND_LIGHT, textColor: 20 },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  // ─── PÁGINA: DEMONSTRATIVO POR CATEGORIA ───────────────────
  doc.addPage("a4", "portrait");
  header(doc, settings, "Demonstrativo de Despesas por Categoria");

  const byCategory = new Map<string, { label: string; total: number; count: number }>();
  for (const m of months) {
    for (const e of m.entries) {
      const d = Number(e.debit);
      if (!d) continue;
      const key = e.classification;
      const cur = byCategory.get(key) ?? { label: labelOf(e.classification), total: 0, count: 0 };
      cur.total += d;
      cur.count += 1;
      byCategory.set(key, cur);
    }
  }
  const catRows = Array.from(byCategory.values())
    .sort((a, b) => b.total - a.total)
    .map((r) => [
      r.label,
      String(r.count),
      formatNumber(r.total),
      totalD > 0 ? `${((r.total / totalD) * 100).toFixed(2)}%` : "0,00%",
    ]);

  autoTable(doc, {
    startY: 80,
    head: [["Categoria", "Lançamentos", "Total (R$)", "% do total"]],
    body: catRows.length ? catRows : [["—", "0", "0,00", "0,00%"]],
    foot: [[
      { content: "TOTAL DE DESPESAS", styles: { fontStyle: "bold" } },
      { content: String(months.reduce((s, m) => s + m.entries.filter((e) => Number(e.debit) > 0).length, 0)), styles: { halign: "center", fontStyle: "bold" } },
      { content: formatNumber(totalD), styles: { halign: "right", fontStyle: "bold" } },
      { content: "100,00%", styles: { halign: "right", fontStyle: "bold" } },
    ]],
    theme: "grid",
    styles: { font: TITLE_FONT, fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: BRAND, textColor: 255, halign: "center" },
    footStyles: { fillColor: BRAND_LIGHT, textColor: 20 },
    columnStyles: {
      1: { halign: "center", cellWidth: 80 },
      2: { halign: "right", cellWidth: 100 },
      3: { halign: "right", cellWidth: 80 },
    },
    margin: { left: 40, right: 40 },
  });

  // ─── PÁGINAS POR MÊS ───────────────────────────────────────
  let runningAcc = opening;
  for (let i = 0; i < months.length; i++) {
    const md = months[i];
    const mc = md.entries.reduce((s, e) => s + Number(e.credit), 0);
    const mdb = md.entries.reduce((s, e) => s + Number(e.debit), 0);
    const monthFinal = md.opening + mc - mdb;
    runningAcc = monthFinal;

    if (opts.withMonthSeparators) {
      // Capa mensal (retrato)
      doc.addPage("a4", "portrait");
      doc.setFillColor(...BRAND);
      doc.rect(0, 0, w, h, "F");
      doc.setFillColor(255, 255, 255);
      doc.rect(40, 40, w - 80, h - 80, "F");

      doc.setFillColor(...BRAND);
      doc.rect(40, 40, w - 80, 90, "F");
      doc.setTextColor(255);
      doc.setFont(TITLE_FONT, "bold");
      doc.setFontSize(16);
      doc.text("PRESTAÇÃO DE CONTAS — MÊS DE REFERÊNCIA", w / 2, 85, { align: "center" });
      doc.setFont(TITLE_FONT, "normal");
      doc.setFontSize(11);
      doc.text(settings.identification, w / 2, 108, { align: "center" });

      doc.setTextColor(20);
      doc.setFont(TITLE_FONT, "bold");
      doc.setFontSize(28);
      doc.text(monthLabel(md.month.reference).toUpperCase(), w / 2, 220, { align: "center" });

      autoTable(doc, {
        startY: 260,
        head: [["Resumo do mês", "Valor (R$)"]],
        body: [
          ["Saldo anterior", formatNumber(md.opening)],
          ["Total de receitas (créditos)", formatNumber(mc)],
          ["Total de despesas (débitos)", formatNumber(mdb)],
          ["Saldo final do mês", formatNumber(monthFinal)],
          ["Quantidade de lançamentos", String(md.entries.length)],
        ],
        theme: "grid",
        styles: { font: TITLE_FONT, fontSize: 11, cellPadding: 7 },
        headStyles: { fillColor: BRAND, textColor: 255 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        margin: { left: 90, right: 90 },
      });

      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(
        "A seguir, a planilha completa do mês e, na sequência, os comprovantes digitalizados anexados.",
        w / 2,
        h - 130,
        { align: "center", maxWidth: w - 160 },
      );
    }

    // Planilha do mês (paisagem) — "imagem 1"
    doc.addPage("a4", "landscape");
    header(doc, settings, `Planilha — ${monthLabel(md.month.reference)}`);
    tableForMonth(doc, md, 75);
  }

  // ─── FECHAMENTO FINAL ──────────────────────────────────────
  doc.addPage("a4", "portrait");
  header(doc, settings, "Fechamento e Conferência da Prestação");

  autoTable(doc, {
    startY: 80,
    head: [["Indicador", "Valor"]],
    body: [
      ["Período prestado", `${monthLabel(settings.period_start)} a ${monthLabel(settings.period_end)}`],
      ["Meses incluídos", String(months.length)],
      ["Lançamentos totais", String(totalEntries)],
      ["Saldo inicial do período", `R$ ${formatNumber(opening)}`],
      ["Total executado em receitas", `R$ ${formatNumber(totalC)}`],
      ["Total executado em despesas", `R$ ${formatNumber(totalD)}`],
      ["Resultado líquido do período", `R$ ${formatNumber(totalC - totalD)}`],
      ["Saldo final do período", `R$ ${formatNumber(finalBalance)}`],
      ["Pendentes de classificação", String(totalUnclassified)],
    ],
    theme: "grid",
    styles: { font: TITLE_FONT, fontSize: 11, cellPadding: 7 },
    headStyles: { fillColor: BRAND, textColor: 255 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 70, right: 70 },
  });

  const decl =
    "Declaro, sob as penas da lei, que as informações contidas nesta prestação de contas são " +
    "verdadeiras e refletem fielmente a movimentação financeira do período acima indicado, conforme " +
    "documentos de suporte (extratos bancários e comprovantes) anexados ao presente relatório.";
  doc.setFont(TITLE_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(doc.splitTextToSize(decl, w - 120), 60, h - 230);

  doc.setDrawColor(120);
  doc.line(80, h - 130, w - 80, h - 130);
  doc.text("Assinatura do responsável técnico", w / 2, h - 116, { align: "center" });
  doc.setFont(TITLE_FONT, "bold");
  doc.setFontSize(10);
  doc.text(settings.responsible, w / 2, h - 100, { align: "center" });
  doc.setFont(TITLE_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Brasília, ${new Date().toLocaleDateString("pt-BR")}`, w / 2, h - 80, { align: "center" });

  footerPage(doc, settings);

  return new Uint8Array(doc.output("arraybuffer"));
}

/**
 * Async: gera o relatório completo, intercalando capa mensal + planilha + comprovantes digitalizados de cada mês.
 */
export async function exportFullPDF(months: MonthData[], settings: Settings) {
  // 1) Constrói esqueleto (capa, resumos, planilhas) sem capas mensais — vamos inseri-las junto aos recibos
  //    para manter a sequência: capa-mes → planilha → comprovantes daquele mes.
  // Estratégia: usamos withMonthSeparators=true e depois inserimos os PDFs de recibos após a planilha de cada mês.

  const base = buildReportPDF(months, settings, { withMonthSeparators: true });
  const out = await PDFDocument.load(base);

  // Estrutura de páginas atualmente:
  //  - 1 capa geral
  //  - 1 resumo mensal
  //  - 1 demonstrativo por categoria
  //  - para cada mês: 1 capa mensal (retrato) + 1 planilha (paisagem)
  //  - 1 fechamento final
  // Inseriremos os recibos logo após a planilha de cada mês.

  // pdf-lib não preserva referências de página depois de inserções; trabalhamos com cópia
  // construindo um novo documento na ordem desejada.
  const result = await PDFDocument.create();
  const baseDoc = await PDFDocument.load(base);

  const fixed = 3; // capa, resumo mensal, demonstrativo
  const perMonth = 2; // capa do mês + planilha

  // Copia páginas fixas iniciais
  const initialPages = await result.copyPages(baseDoc, [0, 1, 2]);
  initialPages.forEach((p) => result.addPage(p));

  for (let i = 0; i < months.length; i++) {
    const baseStart = fixed + i * perMonth;
    const monthPages = await result.copyPages(baseDoc, [baseStart, baseStart + 1]);
    monthPages.forEach((p) => result.addPage(p));

    const url = months[i].receiptUrl;
    if (url) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const src = await PDFDocument.load(buf);
          const pages = await result.copyPages(src, src.getPageIndices());
          pages.forEach((p) => result.addPage(p));
        }
      } catch (e) {
        console.warn("Falha ao mesclar comprovantes do mês", months[i].month.reference, e);
      }
    }
  }

  // Página de fechamento (última do base)
  const lastIndex = baseDoc.getPageCount() - 1;
  const closing = await result.copyPages(baseDoc, [lastIndex]);
  closing.forEach((p) => result.addPage(p));

  const bytes = await result.save();
  // Marca para evitar reuso de variável base
  void out;

  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  a.href = objectUrl;
  a.download = `prestacao-completa-${settings.period_start}_${settings.period_end}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Gera o mesmo relatório institucional completo, mas restrito a um único mês.
 * Inclui capa geral, resumo, demonstrativo por categoria, capa mensal + planilha,
 * comprovantes digitalizados (se anexados) e página de fechamento.
 */
export async function exportSingleMonthFullPDF(md: MonthData, settings: Settings) {
  const scopedSettings: Settings = {
    ...settings,
    period_start: md.month.reference,
    period_end: md.month.reference,
  };
  await exportFullPDF([md], scopedSettings);
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

  // Aba por categoria
  const cat = new Map<string, number>();
  for (const m of months) {
    for (const e of m.entries) {
      const d = Number(e.debit);
      if (!d) continue;
      cat.set(labelOf(e.classification), (cat.get(labelOf(e.classification)) ?? 0) + d);
    }
  }
  const catSheet: (string | number)[][] = [["Categoria", "Total (R$)"]];
  Array.from(cat.entries()).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => catSheet.push([k, v]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catSheet), "Despesas por Categoria");

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
