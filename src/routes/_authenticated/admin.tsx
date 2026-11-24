import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL, GAMES, HOUSE_FEE, brl, errMsg, prizeFor, type GameKey } from "@/lib/arena";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (context.user.email !== ADMIN_EMAIL) throw redirect({ to: "/lobby" });
  },
  head: () => ({ meta: [{ title: "Painel Admin — Arena X1" }, { name: "description", content: "Administração da Arena X1." }, { property: "og:title", content: "Painel Admin — Arena X1" }, { property: "og:description", content: "Administração da Arena X1." }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const { data: proofs = [] } = useQuery({
    queryKey: ["admin", "proofs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("proofs").select("*, matches(*)").eq("status", "pending").order("created_at");
      if (error) throw error;
      const paths = data.map((p) => p.image_path);
      const signed = paths.length ? (await supabase.storage.from("proofs").createSignedUrls(paths, 3600)).data ?? [] : [];
      return data.map((p, i) => ({ ...p, url: signed[i]?.signedUrl }));
    },
    refetchInterval: 10000,
  });
  const { data: wds = [] } = useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: deps = [] } = useQuery({
    queryKey: ["admin", "deposits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deposits").select("*").eq("status", "pending").order("created_at");
      if (error) throw error;
      const signed = data.length ? (await supabase.storage.from("proofs").createSignedUrls(data.map((d) => d.image_path), 3600)).data ?? [] : [];
      return data.map((d, i) => ({ ...d, url: signed[i]?.signedUrl }));
    },
    refetchInterval: 10000,
  });

  const run = useMutation({
    mutationFn: async (fn: () => PromiseLike<{ error: unknown }>) => { const { error } = await fn(); if (error) throw error; },
    onSuccess: () => { toast.success("Feito!"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const pendingWds = wds.filter((w) => w.status === "pending");

  return (
    <div className="space-y-4 px-4 pt-4">
      <h1 className="text-2xl font-bold">Painel <span className="text-primary">Admin</span></h1>
      <Tabs defaultValue="depositos">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="depositos">Depósitos ({deps.length})</TabsTrigger>
          <TabsTrigger value="prints">Prints ({proofs.length})</TabsTrigger>
          <TabsTrigger value="saques">Saques ({pendingWds.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="depositos" className="space-y-3 pt-3">
          {deps.length === 0 && <p className="text-sm text-muted-foreground">Nenhum depósito pendente.</p>}
          {deps.map((d) => (
            <div key={d.id} className="space-y-2 rounded-2xl border bg-card p-4">
              <div className="flex justify-between gap-2">
                <span className="break-all text-sm">{d.email}</span>
                <span className="font-display text-primary">{brl(d.amount)}</span>
              </div>
              <p className="text-xs text-muted-foreground">@{d.nickname} • {new Date(d.created_at).toLocaleString("pt-BR")}</p>
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">Ver comprovante</a>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate(() => supabase.rpc("admin_resolve_deposit", { _id: d.id, _approve: false }))}>Rejeitar</Button>
                <Button variant="neon" disabled={run.isPending} onClick={() => run.mutate(() => supabase.rpc("admin_resolve_deposit", { _id: d.id, _approve: true }))}>Aprovar</Button>
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="prints" className="space-y-3 pt-3">
          {proofs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum print pendente.</p>}
          {proofs.map((p) => {
            const m = p.matches;
            const stake = Number(m?.stake ?? 0);
            return (
              <div key={p.id} className="space-y-3 rounded-2xl border bg-card p-4">
                <div className="flex justify-between text-sm">
                  <span>{GAMES[m?.game as GameKey]?.emoji} {m?.creator_nick} vs {m?.opponent_nick}</span>
                  <span className="text-muted-foreground">{brl(stake)} cada</span>
                </div>
                <p className="text-sm">Vencedor alegado: <b className="text-primary">{p.nickname}</b></p>
                {p.url && <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="Print da vitória" className="max-h-80 w-full rounded-xl border object-contain" /></a>}
                <p className="text-xs text-muted-foreground">Paga {brl(prizeFor(stake))} • taxa retida {brl(stake * 2 * HOUSE_FEE)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate(() => supabase.rpc("admin_reject_proof", { _proof_id: p.id }))}>Recusar</Button>
                  <Button variant="neon" disabled={run.isPending} onClick={() => run.mutate(() => supabase.rpc("admin_approve_proof", { _proof_id: p.id }))}>Aprovar</Button>
                </div>
              </div>
            );
          })}
        </TabsContent>
        <TabsContent value="saques" className="space-y-3 pt-3">
          {wds.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido de saque.</p>}
          {wds.map((w) => (
            <div key={w.id} className="rounded-2xl border bg-card p-4">
              <div className="flex justify-between">
                <span className="font-display">{w.nickname}</span>
                <span className="font-display text-primary">{brl(w.amount)}</span>
              </div>
              <p className="mt-1 break-all text-sm text-muted-foreground">Chave Pix: <span className="text-foreground">{w.pix_key}</span></p>
              <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</p>
              {w.status === "pending" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate(() => supabase.rpc("admin_resolve_withdraw", { _id: w.id, _approve: false }))}>Recusar e estornar</Button>
                  <Button variant="neon" disabled={run.isPending} onClick={() => run.mutate(() => supabase.rpc("admin_resolve_withdraw", { _id: w.id, _approve: true }))}>Marcar pago</Button>
                </div>
              ) : (
                <p className={`mt-2 text-sm ${w.status === "paid" ? "text-primary" : "text-destructive"}`}>{w.status === "paid" ? "Pago" : "Recusado (estornado)"}</p>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
