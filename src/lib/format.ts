export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const formatBRL = (n: number | null | undefined) =>
  n == null ? "-" : BRL.format(Number(n));

export const formatNumber = (n: number | null | undefined) =>
  n == null || Number(n) === 0
    ? "-"
    : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));

export const formatDateBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

export const formatDateBRFull = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const monthLabel = (ref: string) => {
  const [y, m] = ref.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]}/${y}`;
};

export const monthShort = (ref: string) => {
  const [y, m] = ref.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)}/${String(y).slice(2)}`;
};
