import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { DEPOSIT_STATUS, MIN_DEPOSIT, MIN_WITHDRAW, PIX_KEY, PIX_NAME, brl, errMsg, profileQuery } from "@/lib/arena";

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
  const [file, setFile] = useState<File | null>(null);

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

  const { data: deps = [] } = useQuery({
    queryKey: ["deposits", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deposits").select("*").eq("user_id", profile?.id ?? "").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const close = () => { setMode(null); setAmount(""); setPix(""); setFile(null); };
  const value = Number(amount.replace(",", "."));

  const deposit = useMutation({
    mutationFn: async () => {
      if (!(value >= MIN_DEPOSIT)) throw new Error("Depósito mínimo de R$ 5,00");
      if (!file || !profile) throw new Error("Anexe o comprovante");
      const path = `${profile.id}/deposito-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
      const up = await supabase.storage.from("proofs").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.rpc("request_deposit", { _amount: value, _path: path });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Comprovante enviado! Aguarde a análise."); qc.invalidateQueries(); close(); },
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

      {deps.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">Meus depósitos</h2>
          {deps.map((d) => (
            <div key={d.id} className="mb-2 flex justify-between rounded-xl border bg-card px-4 py-3 text-sm">
              <span>{brl(d.amount)} • {new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
              <span className={d.status === "approved" ? "text-primary" : d.status === "rejected" ? "text-destructive" : "text-warning"}>{DEPOSIT_STATUS[d.status] ?? d.status}</span>
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
          {mode === "dep" && (
            <div className="space-y-2 rounded-xl border border-primary/40 bg-secondary p-3 text-sm">
              <p className="text-muted-foreground">Chave Pix (CPF)</p>
              <p className="font-display text-lg text-primary">{PIX_KEY}</p>
              <p>Favorecido: <b>{PIX_NAME}</b></p>
              <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(PIX_KEY); toast.success("Chave copiada!"); }}><Copy />Copiar Chave</Button>
            </div>
          )}
          {(
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (mode === "dep") deposit.mutate(); else withdraw.mutate(); }}>
              <div className="space-y-1.5">
                <Label htmlFor="amt">Valor (R$)</Label>
                <Input id="amt" inputMode="decimal" type="number" min={mode === "saq" ? MIN_WITHDRAW : MIN_DEPOSIT} step="0.01" placeholder={mode === "saq" ? "mín. 10,00" : "mín. 5,00"} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg" autoFocus />
                {mode === "dep" && (
                  <div className="flex gap-2 pt-1">{[10, 20, 50, 100].map((v) => (
                    <button type="button" key={v} onClick={() => setAmount(String(v))} className="flex-1 rounded-lg border bg-secondary py-1.5 text-sm">R$ {v}</button>
                  ))}</div>
                )}
              </div>
              {mode === "dep" && (
                <div className="space-y-1.5">
                  <Label htmlFor="comp">Comprovante Pix (foto/print)</Label>
                  <Input id="comp" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
                </div>
              )}
              {mode === "saq" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pix">Chave Pix</Label>
                  <Input id="pix" placeholder="CPF, e-mail, celular ou aleatória" value={pix} onChange={(e) => setPix(e.target.value)} className="h-12" required />
                  <p className="text-xs text-muted-foreground">Saque mínimo de R$ 10,00. Saldo: {brl(profile?.balance ?? 0)}</p>
                </div>
              )}
              <Button type="submit" variant="neon" size="xl" className="w-full" disabled={withdraw.isPending || deposit.isPending}>
                {mode === "dep" ? "Enviar Comprovante" : "Solicitar saque"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
