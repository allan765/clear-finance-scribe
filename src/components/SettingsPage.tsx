import { useState, useEffect } from "react";
import { useSettings, useUpdateSettings } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function SettingsPage() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();

  const [form, setForm] = useState({
    responsible: "",
    identification: "",
    initial_balance: "0",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        responsible: settings.responsible,
        identification: settings.identification,
        initial_balance: String(settings.initial_balance),
      });
    }
  }, [settings]);

  if (!settings) return <div className="p-8">Carregando...</div>;

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2">Configurações</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Estes dados aparecem na capa e em todas as páginas do PDF final.
      </p>

      <div className="bg-card border rounded p-6 space-y-5">
        <div>
          <Label htmlFor="ident">Identificação da prestação</Label>
          <Textarea
            id="ident"
            value={form.identification}
            onChange={(e) => setForm({ ...form, identification: e.target.value })}
            rows={2}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Ex: Curatela de João Resende Filho — Processo nº 0000000-00.0000.0.00.0000</p>
        </div>

        <div>
          <Label htmlFor="resp">Responsável (assinatura)</Label>
          <Textarea
            id="resp"
            value={form.responsible}
            onChange={(e) => setForm({ ...form, responsible: e.target.value })}
            rows={2}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="bal">Saldo inicial do período (R$)</Label>
          <Input
            id="bal"
            type="number"
            step="0.01"
            value={form.initial_balance}
            onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Saldo da conta antes do primeiro mês da prestação.</p>
        </div>

        <div>
          <Label>Período da prestação</Label>
          <div className="text-sm text-muted-foreground mt-1">
            Junho/2025 a Junho/2026 (13 meses, pré-configurado)
          </div>
        </div>

        <Button
          onClick={async () => {
            await update.mutateAsync({
              id: settings.id,
              responsible: form.responsible,
              identification: form.identification,
              initial_balance: Number(form.initial_balance),
            });
            toast.success("Configurações salvas");
          }}
        >
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
