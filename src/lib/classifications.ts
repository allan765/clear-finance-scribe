export type Classification =
  | "agua_esgoto"
  | "alimentacao"
  | "aluguel"
  | "aposentadoria"
  | "aplicacao_poupanca"
  | "cartao_credito"
  | "cartorio"
  | "combustivel"
  | "condominio"
  | "darf_unificado"
  | "despesa_fazenda"
  | "despesas_animais"
  | "despesas_bancarias"
  | "despesas_medicas"
  | "e_social"
  | "educacao"
  | "energia"
  | "equipamento_acessibilidade"
  | "farmacia"
  | "faxina"
  | "grafica"
  | "guia_simples_nacional"
  | "internet"
  | "irrf"
  | "iptu"
  | "lazer"
  | "lazer_convivencia_social"
  | "manutencao_residencial"
  | "nao_classificado"
  | "outros"
  | "pix_recebido"
  | "reembolso"
  | "reparos_domesticos"
  | "rendimento"
  | "salario"
  | "saque"
  | "saude"
  | "servico_cuidador"
  | "supermercado"
  | "telefone"
  | "transferencias"
  | "transporte"
  | "utilidades_casa"
  | "vestuario";

export const CLASSIFICATIONS: { value: Classification; label: string }[] = [
  { value: "agua_esgoto", label: "Água e esgoto" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "aluguel", label: "Aluguel" },
  { value: "aposentadoria", label: "Aposentadoria" },
  { value: "aplicacao_poupanca", label: "Aplicação poupança" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartorio", label: "Cartório" },
  { value: "combustivel", label: "Combustível" },
  { value: "condominio", label: "Condomínio" },
  { value: "darf_unificado", label: "DARF Unificado" },
  { value: "despesa_fazenda", label: "Despesa com a fazenda" },
  { value: "despesas_animais", label: "Despesas com animais" },
  { value: "despesas_bancarias", label: "Despesas bancárias" },
  { value: "despesas_medicas", label: "Despesas médicas" },
  { value: "e_social", label: "E-Social" },
  { value: "educacao", label: "Educação" },
  { value: "energia", label: "Energia" },
  { value: "equipamento_acessibilidade", label: "Equipamento de acessibilidade" },
  { value: "farmacia", label: "Farmácia" },
  { value: "faxina", label: "Faxina" },
  { value: "grafica", label: "Gráfica" },
  { value: "guia_simples_nacional", label: "Guia do Simples Nacional" },
  { value: "internet", label: "Internet" },
  { value: "irrf", label: "IRRF - IRRF" },
  { value: "iptu", label: "Iptu" },
  { value: "lazer", label: "Lazer" },
  { value: "lazer_convivencia_social", label: "Lazer e convivência social" },
  { value: "manutencao_residencial", label: "Manutenção residencial" },
  { value: "nao_classificado", label: "— Não classificado —" },
  { value: "outros", label: "Outros" },
  { value: "pix_recebido", label: "Pix recebido" },
  { value: "reembolso", label: "Reembolso" },
  { value: "reparos_domesticos", label: "Reparos domésticos" },
  { value: "rendimento", label: "Rendimento" },
  { value: "salario", label: "Salário" },
  { value: "saque", label: "Saque" },
  { value: "saude", label: "Saúde" },
  { value: "servico_cuidador", label: "Serviço de cuidador" },
  { value: "supermercado", label: "Supermercado" },
  { value: "telefone", label: "Telefone" },
  { value: "transferencias", label: "Transferências" },
  { value: "transporte", label: "Transporte" },
  { value: "utilidades_casa", label: "Utilidades da Casa" },
  { value: "vestuario", label: "Vestuário" },
];

export const labelOf = (c: Classification) =>
  CLASSIFICATIONS.find((x) => x.value === c)?.label ?? c;
