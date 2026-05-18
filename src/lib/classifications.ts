export type Classification =
  | "salario"
  | "supermercado"
  | "agua_esgoto"
  | "energia"
  | "internet"
  | "telefone"
  | "combustivel"
  | "farmacia"
  | "condominio"
  | "aplicacao_poupanca"
  | "transferencias"
  | "saude"
  | "educacao"
  | "lazer"
  | "vestuario"
  | "alimentacao"
  | "transporte"
  | "impostos"
  | "outros"
  | "nao_classificado";

export const CLASSIFICATIONS: { value: Classification; label: string }[] = [
  { value: "salario", label: "Salário" },
  { value: "supermercado", label: "Supermercado" },
  { value: "agua_esgoto", label: "Água e esgoto" },
  { value: "energia", label: "Energia" },
  { value: "internet", label: "Internet" },
  { value: "telefone", label: "Telefone" },
  { value: "combustivel", label: "Combustível" },
  { value: "farmacia", label: "Farmácia" },
  { value: "condominio", label: "Condomínio" },
  { value: "aplicacao_poupanca", label: "Aplicação poupança" },
  { value: "transferencias", label: "Transferências" },
  { value: "saude", label: "Saúde" },
  { value: "educacao", label: "Educação" },
  { value: "lazer", label: "Lazer" },
  { value: "vestuario", label: "Vestuário" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "impostos", label: "Impostos" },
  { value: "outros", label: "Outros" },
  { value: "nao_classificado", label: "— Não classificado —" },
];

export const labelOf = (c: Classification) =>
  CLASSIFICATIONS.find((x) => x.value === c)?.label ?? c;
