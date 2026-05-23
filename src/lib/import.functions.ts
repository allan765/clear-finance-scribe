import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ParsedTxnSchema = z.object({
  date: z.string().describe("YYYY-MM-DD"),
  description: z.string(),
  credit: z.number().default(0),
  debit: z.number().default(0),
  balance: z.number().nullable().optional(),
  classification: z.string().default("nao_classificado"),
});

const InputSchema = z.object({
  kind: z.enum(["bank", "expense"]),
  monthRef: z.string().regex(/^\d{4}-\d{2}$/),
  // Conteúdo textual (CSV/OFX/TXT/PDF com texto extraído)
  text: z.string().optional(),
  // Imagem única (data URL)
  imageDataUrl: z.string().optional(),
  // Múltiplas imagens (ex.: páginas de PDF escaneado)
  imageDataUrls: z.array(z.string()).optional(),
  filename: z.string().optional(),
});

const CLASSIFICATIONS = [
  "agua_esgoto","alimentacao","aluguel","aposentadoria","aplicacao_poupanca",
  "cartao_credito","cartorio","combustivel","condominio","darf_unificado",
  "despesa_fazenda","despesas_animais","despesas_bancarias","despesas_medicas",
  "e_social","educacao","energia","equipamento_acessibilidade","farmacia",
  "faxina","guia_simples_nacional","internet","irrf","iptu","lazer",
  "lazer_convivencia_social","manutencao_residencial","outros","pix_recebido",
  "reembolso","reparos_domesticos","rendimento","salario","saque","saude",
  "servico_cuidador","supermercado","telefone","transferencias","transporte",
  "vestuario","nao_classificado",
];

export const parseStatement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const [yearStr, monthStr] = data.monthRef.split("-");
    const monthNum = Number(monthStr);
    const yearNum = Number(yearStr);
    const mm = monthNum.toString().padStart(2, "0");

    const hasImages = !!data.imageDataUrl || (data.imageDataUrls && data.imageDataUrls.length > 0);

    const systemPrompt = `Você é um especialista em interpretar EXTRATOS BANCÁRIOS e RELATÓRIOS DE DESPESAS brasileiros, mesmo quando vêm de PDFs digitalizados, com OCR de baixa qualidade, tabelas quebradas ou textos desalinhados.

OBJETIVO: extrair TODOS os lançamentos financeiros do conteúdo e retornar APENAS os do mês ${mm}/${yearNum}.

${data.kind === "bank"
  ? `Este é um EXTRATO BANCÁRIO. Para cada linha real de movimentação identifique:
- Data da movimentação (DD/MM/AAAA → converta para YYYY-MM-DD)
- Histórico/descrição (limpe códigos internos, agências, números longos sem sentido)
- Tipo: ENTRADA (crédito) ou SAÍDA (débito) — use sinais (-), parênteses, colunas "D"/"C", palavras como "DEB", "CRED", "Saque", "TED enviado", "PIX enviado/recebido", "TARIFA"
- Valor (sempre positivo, em reais — use ponto como decimal)
- Saldo final da linha (se houver) → campo "balance"`
  : `Este é um RELATÓRIO DE DESPESAS. Todos os valores devem ir em "debit" (saídas). "credit" sempre 0.`}

Para cada lançamento, classifique em UMA destas categorias:
${CLASSIFICATIONS.join(", ")}

REGRAS IMPORTANTES:
- date: SEMPRE no formato YYYY-MM-DD
- description: texto descritivo limpo e legível
- credit: número positivo se entrada, senão 0
- debit: número positivo se saída, senão 0
- balance: número (positivo ou negativo) representando saldo após o lançamento; null se não houver
- Use "nao_classificado" quando estiver em dúvida
- IGNORE: saldos de abertura/fechamento isolados, totais, subtotais, cabeçalhos, rodapés, "SALDO DO DIA", "SALDO ANTERIOR", "SALDO BLOQUEADO" — apenas LANÇAMENTOS REAIS
- IGNORE linhas duplicadas (ex.: descrição repetida em quebra de página)
- PRESERVE A ORDEM ORIGINAL do documento (de cima para baixo, na sequência exata em que aparecem no extrato) — NÃO reordene por data
- Se uma data estiver ambígua (ex.: só "15/06"), assuma o mês/ano alvo: ${mm}/${yearNum}`;

    const userContent: Array<Record<string, unknown>> = [];
    if (data.text) {
      userContent.push({
        type: "text",
        text: `Arquivo: ${data.filename ?? "documento"}\n\nConteúdo extraído:\n${data.text.slice(0, 150000)}`,
      });
    }
    if (hasImages) {
      const intro = data.text
        ? `Imagens das páginas do documento "${data.filename ?? ""}" (use como fonte primária — o texto extraído pode estar incompleto).`
        : `Arquivo: ${data.filename ?? "imagem"}. Extraia os lançamentos diretamente das imagens (pode ser PDF escaneado).`;
      userContent.push({ type: "text", text: intro });
      const urls = data.imageDataUrls ?? (data.imageDataUrl ? [data.imageDataUrl] : []);
      for (const url of urls) {
        userContent.push({ type: "image_url", image_url: { url } });
      }
    }
    if (userContent.length === 0) throw new Error("Nenhum conteúdo enviado");

    const tools = [
      {
        type: "function",
        function: {
          name: "registrar_lancamentos",
          description: "Registra os lançamentos extraídos do documento",
          parameters: {
            type: "object",
            properties: {
              transactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", description: "YYYY-MM-DD" },
                    description: { type: "string" },
                    credit: { type: "number" },
                    debit: { type: "number" },
                    balance: { type: ["number", "null"], description: "Saldo após o lançamento, se disponível" },
                    classification: { type: "string", enum: CLASSIFICATIONS },
                  },
                  required: ["date", "description", "credit", "debit", "classification"],
                },
              },
            },
            required: ["transactions"],
          },
        },
      },
    ];

    // Usa modelo mais robusto quando há imagens (OCR/visão), e o flash para texto puro
    const model = hasImages ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "registrar_lancamentos" } },
      }),
    });

    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Configurações > Workspace.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Falha na IA (${res.status}): ${t.slice(0, 300)}`);
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return { transactions: [] as z.infer<typeof ParsedTxnSchema>[] };
    }
    const args = JSON.parse(toolCall.function.arguments);
    const parsed = z.array(ParsedTxnSchema).parse(args.transactions ?? []);

    // Filtrar somente o mês alvo — preservando a ORDEM ORIGINAL do extrato/documento
    const filtered = parsed.filter((t) => t.date.startsWith(data.monthRef));

    return { transactions: filtered };
  });

