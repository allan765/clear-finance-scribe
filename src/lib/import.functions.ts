import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ParsedTxnSchema = z.object({
  date: z.string().describe("YYYY-MM-DD"),
  description: z.string(),
  credit: z.number().default(0),
  debit: z.number().default(0),
  classification: z.string().default("nao_classificado"),
});

const InputSchema = z.object({
  kind: z.enum(["bank", "expense"]),
  monthRef: z.string().regex(/^\d{4}-\d{2}$/),
  // For text-based files (CSV/OFX/TXT/PDF-extracted text)
  text: z.string().optional(),
  // For images: data URL (data:image/...;base64,xxxx)
  imageDataUrl: z.string().optional(),
  filename: z.string().optional(),
});

const CLASSIFICATIONS = [
  "salario","supermercado","agua_esgoto","energia","internet","telefone",
  "combustivel","farmacia","condominio","aplicacao_poupanca","transferencias",
  "saude","educacao","lazer","vestuario","alimentacao","transporte","impostos",
  "outros","nao_classificado",
];

export const parseStatement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const [yearStr, monthStr] = data.monthRef.split("-");
    const monthNum = Number(monthStr);
    const yearNum = Number(yearStr);

    const systemPrompt = `Você é um especialista em interpretar extratos bancários e relatórios de despesas brasileiros.
Extraia TODOS os lançamentos financeiros do conteúdo fornecido.
Retorne APENAS lançamentos do mês ${monthNum.toString().padStart(2, "0")}/${yearNum}.
${data.kind === "bank"
  ? "Este é um EXTRATO BANCÁRIO. Identifique créditos (entradas) e débitos (saídas)."
  : "Este é um RELATÓRIO DE DESPESAS. Todos os valores devem ir em 'debit' (saídas)."}

Para cada lançamento, classifique em UMA das categorias:
${CLASSIFICATIONS.join(", ")}

Regras:
- date: formato YYYY-MM-DD
- description: texto descritivo limpo (sem códigos internos)
- credit: valor positivo se for entrada (senão 0)
- debit: valor positivo se for saída (senão 0)
- Use "nao_classificado" se tiver dúvida
- IGNORE saldos, totalizadores e cabeçalhos — só lançamentos reais
- Ordene por data crescente`;

    const userContent: Array<Record<string, unknown>> = [];
    if (data.text) {
      userContent.push({
        type: "text",
        text: `Arquivo: ${data.filename ?? "documento"}\n\nConteúdo:\n${data.text.slice(0, 120000)}`,
      });
    }
    if (data.imageDataUrl) {
      userContent.push({
        type: "text",
        text: `Arquivo: ${data.filename ?? "imagem"}. Extraia os lançamentos da imagem.`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: data.imageDataUrl },
      });
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

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

    // Filtrar somente o mês alvo e ordenar por data
    const filtered = parsed
      .filter((t) => t.date.startsWith(data.monthRef))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { transactions: filtered };
  });
