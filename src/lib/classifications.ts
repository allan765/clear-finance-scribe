// ============================================================
// RECEITAS (Entradas)
// ============================================================
// aposentadoria  → "Aposentadoria"
// pensao         → "Pensão"
// beneficio_assistencial → "Benefício assistencial"
// salario        → "Salário"
// rendimento     → "Rendimentos bancários"
// aplicacao_poupanca → "Aplicações financeiras"
// venda_bens     → "Venda de bens"
// restituicao    → "Restituição"
// reembolso      → "Reembolso"
// pix_recebido   → "Pix recebido"
// outros         → "Outros"
//
// MORADIA / UTILIDADES
// agua_esgoto    → "Água e esgoto"
// energia        → "Energia"
// gas            → "Gás"
// internet       → "Internet"
// telefone       → "Telefone"
// condominio     → "Condomínio"
// aluguel        → "Aluguel"
// utilidades_casa → "Utilidades da Casa"
// iptu           → "IPTU"
//
// SAÚDE
// despesas_medicas → "Despesas médicas"
// farmacia       → "Farmácia"
// saude          → "Saúde"
// equipamento_acessibilidade → "Equipamento de acessibilidade"
// servico_cuidador → "Serviço de cuidador"
//
// MANUTENÇÃO E REPAROS
// manutencao_residencial → "Reparos e manutenção"  (unificado com reparos_domesticos)
// manutencao_maquinas → "Manutenção de máquinas"
// manutencao_veiculo → "Manutenção de veículo"
// despesa_fazenda → "Fazenda – Cercas e manutenção geral"
//
// PESSOAL / HIGIENE
// cabeleireiro   → "Cabeleireiro"
// higiene_pessoal → "Higiene pessoal"
// vestuario      → "Vestuário"
//
// ALIMENTAÇÃO
// alimentacao    → "Alimentação"
// supermercado   → "Supermercado"
//
// TRANSPORTE
// combustivel    → "Combustível"
// transporte     → "Transporte"
// saque          → "Saque"
//
// IMPOSTOS / TRIBUTOS
// darf_unificado → "DARF Unificado"
// irrf           → "IRRF - IRRF"
// guia_simples_nacional → "Guia do Simples Nacional"
// e_social       → "E-Social / Simples Doméstico"
// cartorio       → "Cartório"
//
// BANCÁRIO
// despesas_bancarias → "Tarifas bancárias"
// cartao_credito → "Cartão de crédito"
// transferencias → "Transferências"
//
// LAZER / EDUCAÇÃO
// lazer          → "Lazer e convivência social"  (unificado com lazer_convivencia_social)
// educacao       → "Educação"
//
// OUTROS / SERVIÇOS
// faxina         → "Faxina / Limpeza"
// grafica        → "Gráfica"
// despesas_animais → "Despesas com animais"
// nao_classificado → "— Não classificado —"
// ============================================================

export type Classification =
  // Receitas
  | "aposentadoria"
  | "pensao"
  | "beneficio_assistencial"
  | "salario"
  | "rendimento"
  | "aplicacao_poupanca"
  | "venda_bens"
  | "restituicao"
  | "reembolso"
  | "pix_recebido"
  | "outros_creditos"
  | "outros"
  // Moradia / Utilidades
  | "agua_esgoto"
  | "energia"
  | "gas"
  | "internet"
  | "telefone"
  | "condominio"
  | "aluguel"
  | "utilidades_casa"
  | "iptu"
  // Saúde
  | "despesas_medicas"
  | "farmacia"
  | "saude"
  | "equipamento_acessibilidade"
  | "servico_cuidador"
  // Manutenção
  | "manutencao_residencial"
  | "manutencao_maquinas"
  | "manutencao_veiculo"
  | "despesa_fazenda"
  // Pessoal / Higiene
  | "cabeleireiro"
  | "higiene_pessoal"
  | "vestuario"
  // Alimentação
  | "alimentacao"
  | "supermercado"
  // Transporte
  | "combustivel"
  | "transporte"
  | "saque"
  // Impostos / Tributos
  | "darf_unificado"
  | "irrf"
  | "guia_simples_nacional"
  | "e_social"
  | "cartorio"
  // Bancário
  | "despesas_bancarias"
  | "cartao_credito"
  | "transferencias"
  // Lazer / Educação
  | "lazer"
  | "educacao"
  // Outros / Serviços
  | "faxina"
  | "grafica"
  | "despesas_animais"
  // Compatibilidade retroativa (não aparecem no menu mas mantêm dados antigos)
  | "lazer_convivencia_social"
  | "reparos_domesticos"
  | "nao_classificado";

export const CLASSIFICATIONS: { value: Classification; label: string; group?: string }[] = [
  // ── RECEITAS ──────────────────────────────────────────────
  { value: "aposentadoria",         label: "Aposentadoria",                    group: "Receitas" },
  { value: "pensao",                label: "Pensão",                           group: "Receitas" },
  { value: "beneficio_assistencial",label: "Benefício assistencial",           group: "Receitas" },
  { value: "salario",               label: "Salário",                          group: "Receitas" },
  { value: "rendimento",            label: "Rendimentos bancários",            group: "Receitas" },
  { value: "aplicacao_poupanca",    label: "Aplicações financeiras",           group: "Receitas" },
  { value: "venda_bens",            label: "Venda de bens",                    group: "Receitas" },
  { value: "restituicao",           label: "Restituição",                      group: "Receitas" },
  { value: "reembolso",             label: "Reembolso",                        group: "Receitas" },
  { value: "pix_recebido",          label: "Pix recebido",                     group: "Receitas" },
  { value: "outros_creditos",       label: "Outros créditos",                  group: "Receitas" },
  { value: "outros",                label: "Outros (Antigo)",                  group: "Receitas" },

  // ── MORADIA / UTILIDADES ──────────────────────────────────
  { value: "agua_esgoto",           label: "Água e esgoto",                    group: "Moradia / Utilidades" },
  { value: "energia",               label: "Energia",                          group: "Moradia / Utilidades" },
  { value: "gas",                   label: "Gás",                              group: "Moradia / Utilidades" },
  { value: "internet",              label: "Internet",                         group: "Moradia / Utilidades" },
  { value: "telefone",              label: "Telefone",                         group: "Moradia / Utilidades" },
  { value: "condominio",            label: "Condomínio",                       group: "Moradia / Utilidades" },
  { value: "aluguel",               label: "Aluguel",                          group: "Moradia / Utilidades" },
  { value: "utilidades_casa",       label: "Utilidades da Casa",               group: "Moradia / Utilidades" },
  { value: "iptu",                  label: "IPTU",                             group: "Moradia / Utilidades" },

  // ── SAÚDE ─────────────────────────────────────────────────
  { value: "despesas_medicas",      label: "Despesas médicas",                 group: "Saúde" },
  { value: "farmacia",              label: "Farmácia",                         group: "Saúde" },
  { value: "saude",                 label: "Saúde",                            group: "Saúde" },
  { value: "equipamento_acessibilidade", label: "Equipamento de acessibilidade", group: "Saúde" },
  { value: "servico_cuidador",      label: "Serviço de cuidador",              group: "Saúde" },

  // ── MANUTENÇÃO E REPAROS ──────────────────────────────────
  { value: "manutencao_residencial",label: "Reparos e manutenção",             group: "Manutenção" },
  { value: "manutencao_maquinas",   label: "Manutenção de máquinas",           group: "Manutenção" },
  { value: "manutencao_veiculo",    label: "Manutenção de veículo",            group: "Manutenção" },
  { value: "despesa_fazenda",       label: "Cercas e manutenção geral/fazenda", group: "Manutenção" },

  // ── PESSOAL / HIGIENE ─────────────────────────────────────
  { value: "cabeleireiro",          label: "Cabeleireiro",                     group: "Pessoal" },
  { value: "higiene_pessoal",       label: "Higiene pessoal",                  group: "Pessoal" },
  { value: "vestuario",             label: "Vestuário",                        group: "Pessoal" },

  // ── ALIMENTAÇÃO ───────────────────────────────────────────
  { value: "alimentacao",           label: "Alimentação",                      group: "Alimentação" },
  { value: "supermercado",          label: "Supermercado",                     group: "Alimentação" },

  // ── TRANSPORTE ────────────────────────────────────────────
  { value: "combustivel",           label: "Combustível",                      group: "Transporte" },
  { value: "transporte",            label: "Transporte",                       group: "Transporte" },
  { value: "saque",                 label: "Saque",                            group: "Transporte" },

  // ── IMPOSTOS / TRIBUTOS ───────────────────────────────────
  { value: "darf_unificado",        label: "DARF Unificado",                   group: "Impostos" },
  { value: "irrf",                  label: "IRRF - IRRF",                      group: "Impostos" },
  { value: "guia_simples_nacional", label: "Guia do Simples Nacional",         group: "Impostos" },
  { value: "e_social",              label: "E-Social / Simples Doméstico",     group: "Impostos" },
  { value: "cartorio",              label: "Cartório",                         group: "Impostos" },

  // ── BANCÁRIO ──────────────────────────────────────────────
  { value: "despesas_bancarias",    label: "Tarifas bancárias",                group: "Bancário" },
  { value: "cartao_credito",        label: "Cartão de crédito",                group: "Bancário" },
  { value: "transferencias",        label: "Transferências",                   group: "Bancário" },

  // ── LAZER / EDUCAÇÃO ──────────────────────────────────────
  { value: "lazer",                 label: "Lazer e convivência social",       group: "Lazer / Educação" },
  { value: "educacao",              label: "Educação",                         group: "Lazer / Educação" },

  // ── OUTROS / SERVIÇOS ─────────────────────────────────────
  { value: "faxina",                label: "Faxina / Limpeza",                 group: "Outros" },
  { value: "grafica",               label: "Gráfica",                          group: "Outros" },
  { value: "despesas_animais",      label: "Despesas com animais",             group: "Outros" },

  // ── NÃO CLASSIFICADO (sempre por último) ─────────────────
  { value: "nao_classificado",      label: "— Não classificado —" },
];

export const labelOf = (c: Classification) =>
  CLASSIFICATIONS.find((x) => x.value === c)?.label ?? c;
