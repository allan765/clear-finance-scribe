export type Classification =
  | "salario"
  | "rendimento"
  | "aposentadoria"
  | "reembolso"
  | "pix_recebido"
  | "supermercado"
  | "agua_esgoto"
  | "energia"
  | "internet"
  | "telefone"
  | "combustivel"
  | "farmacia"
  | "condominio"
  | "cartao_credito"
  | "aplicacao_poupanca"
  | "transferencias"
  | "saque"
  | "saude"
  | "educacao"
  | "lazer"
  | "vestuario"
  | "alimentacao"
  | "transporte"
  | "impostos"
  | "darf_unificado"
  | "guia_simples_nacional"
  | "iptu"
  | "cartorio"
  | "outros"
  | "nao_classificado";

export const CLASSIFICATIONS: { value: Classification; label: string }[] = [
  { value: "salario", label: "Salário" },
  { value: "rendimento", label: "Rendimento" },
  { value: "aposentadoria", label: "Aposentadoria" },
  { value: "reembolso", label: "Reembolso" },
  { value: "pix_recebido", label: "Pix recebido" },
  { value: "supermercado", label: "Supermercado" },
  { value: "agua_esgoto", label: "Água e esgoto" },
  { value: "energia", label: "Energia" },
  { value: "internet", label: "Internet" },
  { value: "telefone", label: "Telefone" },
  { value: "combustivel", label: "Combustível" },
  { value: "farmacia", label: "Farmácia" },
  { value: "condominio", label: "Condomínio" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "aplicacao_poupanca", label: "Aplicação poupança" },
  { value: "transferencias", label: "Transferências" },
  { value: "saque", label: "Saque" },
  { value: "saude", label: "Saúde" },
  { value: "educacao", label: "Educação" },
  { value: "lazer", label: "Lazer" },
  { value: "vestuario", label: "Vestuário" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "impostos", label: "Impostos" },
  { value: "darf_unificado", label: "DARF Unificado" },
  { value: "guia_simples_nacional", label: "Guia do Simples Nacional" },
  { value: "iptu", label: "IPTU" },
  { value: "cartorio", label: "Cartório" },
  { value: "outros", label: "Outros" },
  { value: "nao_classificado", label: "— Não classificado —" },
];

export const labelOf = (c: Classification) =>
  CLASSIFICATIONS.find((x) => x.value === c)?.label ?? c;
