import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { QrCode, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { MIN_WITHDRAW, brl, errMsg, profileQuery } from "@/lib/arena";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({ meta: [{ title: "Carteira Pix — Arena X1" }, { name: "description", content: "Deposite e saque via Pix." }, { property: "og:title", content: "Carteira Pix — Arena X1" }, { property: "og:description", content: "Deposite e saque via Pix." }] }),
  component: Wallet,
});

function Wallet() {
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery);
  const [mode, setMode] = useState<"dep" | "saq" | null>(null);
  const [amount, setAmount] = useState("");
  const [pix, setPix] = useState("");
  const [step, setStep] = useState<"form" | "qr">("form");

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });
  const { data: wds = [] } = useQuery({
    queryKey: ["withdrawals", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("withdrawals").select("*").eq("user_id", profile?.id ?? "").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const close = () => { setMode(null); setAmount(""); setPix(""); setStep("form"); };
  const value = Number(amount.replace(",", "."));

  const deposit = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("deposit", { _amount: value }); if (error) throw error; },
    onSuccess: () => { toast.success(`Pix de ${brl(value)} recebido!`); qc.invalidateQueries(); close(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const withdraw = useMutation({
    mutationFn: async () => {
      if (!(value >= MIN_WITHDRAW)) throw new Error("Saque mínimo de R$ 10,00");
      const { error } = await supabase.rpc("request_withdraw", { _amount: value, _pix_key: pix });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saque solicitado! Você recebe em breve."); qc.invalidateQueries(); close(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-6 px-4 pt-4">
      <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-card p-6 glow">
        <div className="grid-bg absolute inset-0 opacity-50" />
        <div className="relative">
          <p className="text-sm text-muted-foreground">Saldo disponível</p>
          <p className="mt-1 font-display text-4xl font-bold text-primary text-glow">{brl(profile?.balance ?? 0)}</p>
          <p className="mt-1 text-sm">@{profile?.nickname}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="neon" size="xl" onClick={() => setMode("dep")}><ArrowDownToLine />Depositar via Pix</Button>
        <Button variant="outline" size="xl" onClick={() => setMode("saq")}><ArrowUpFromLine />Sacar via Pix</Button>
      </div>

      {wds.some((w) => w.status === "pending") && (
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">Saques pendentes</h2>
          {wds.filter((w) => w.status === "pending").map((w) => (
            <div key={w.id} className="mb-2 flex justify-between rounded-xl border bg-card px-4 py-3 text-sm">
              <span>{w.pix_key}</span><span className="text-warning">{brl(w.amount)} • em análise</span>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">Extrato</h2>
        {txs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>}
        <div className="divide-y rounded-xl border bg-card">
          {txs.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm">{t.note}</p>
                <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <span className={`font-display ${Number(t.amount) >= 0 ? "text-primary" : "text-destructive"}`}>
                {Number(t.amount) >= 0 ? "+" : ""}{brl(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{mode === "dep" ? "Depositar via Pix" : "Sacar via Pix"}</DialogTitle></DialogHeader>
          {mode === "dep" && step === "qr" ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-44 items-center justify-center rounded-2xl border border-primary/50 bg-secondary"><QrCode className="size-28 text-primary" /></div>
              <p className="text-sm text-muted-foreground">Pagamento simulado de <b className="text-foreground">{brl(value)}</b>. Toque abaixo para confirmar.</p>
              <Button variant="neon" size="xl" className="w-full" disabled={deposit.isPending} onClick={() => deposit.mutate()}>Já paguei</Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (mode === "dep") { if (!(value > 0)) { toast.error("Informe um valor"); return; } setStep("qr"); } else withdraw.mutate(); }}>
              <div className="space-y-1.5">
                <Label htmlFor="amt">Valor (R$)</Label>
                <Input id="amt" inputMode="decimal" placeholder={mode === "saq" ? "mín. 10,00" : "20,00"} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg" autoFocus />
                {mode === "dep" && (
                  <div className="flex gap-2 pt-1">{[10, 20, 50, 100].map((v) => (
                    <button type="button" key={v} onClick={() => setAmount(String(v))} className="flex-1 rounded-lg border bg-secondary py-1.5 text-sm">R$ {v}</button>
                  ))}</div>
                )}
              </div>
              {mode === "saq" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pix">Chave Pix</Label>
                  <Input id="pix" placeholder="CPF, e-mail, celular ou aleatória" value={pix} onChange={(e) => setPix(e.target.value)} className="h-12" required />
                  <p className="text-xs text-muted-foreground">Saque mínimo de R$ 10,00. Saldo: {brl(profile?.balance ?? 0)}</p>
                </div>
              )}
              <Button type="submit" variant="neon" size="xl" className="w-full" disabled={withdraw.isPending}>
                {mode === "dep" ? "Gerar Pix" : "Solicitar saque"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
