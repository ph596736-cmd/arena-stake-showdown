import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { Camera, Share2, Copy, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/arena/MatchCard";
import { supabase } from "@/integrations/supabase/client";
import { GAMES, brl, errMsg, prizeFor, type GameKey } from "@/lib/arena";

export const Route = createFileRoute("/_authenticated/partida/$id")({
  head: () => ({ meta: [{ title: "Partida — Arena X1" }, { name: "description", content: "Sua partida X1." }, { property: "og:title", content: "Desafio X1 — Arena X1" }, { property: "og:description", content: "Você foi desafiado para um X1 valendo Pix!" }] }),
  component: Match,
});

function Match() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: m, isLoading } = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 6000,
  });
  const { data: proofs = [] } = useQuery({
    queryKey: ["proofs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("proofs").select("*").eq("match_id", id).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!m,
  });

  const accept = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("accept_match", { _match_id: id }); if (error) throw error; },
    onSuccess: () => { toast.success("Desafio aceito!"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const cancel = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("cancel_match", { _match_id: id }); if (error) throw error; },
    onSuccess: () => { toast.success("Sala cancelada"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `${user.id}/${id}-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
      const up = await supabase.storage.from("proofs").upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { error } = await supabase.rpc("submit_proof", { _match_id: id, _path: path });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Print enviado! Aguarde a análise."); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <p className="p-6 text-muted-foreground">Carregando...</p>;
  if (!m) return <p className="p-6">Sala não encontrada. <Link to="/lobby" className="text-primary">Voltar</Link></p>;

  const g = GAMES[m.game as GameKey];
  const isPlayer = user.id === m.creator_id || user.id === m.opponent_id;
  const link = typeof window !== "undefined" ? `${window.location.origin}/partida/${m.id}` : "";
  const msg = `🔥 Te desafio no X1 de ${g?.label} valendo ${brl(m.stake)} na Arena X1! Aceita? ${link}`;
  const myProof = proofs.find((p) => p.user_id === user.id);
  const statusLabel: Record<string, string> = { open: "Aguardando adversário", live: "Partida em andamento", review: "Print em análise", finished: "Finalizada", cancelled: "Cancelada" };

  return (
    <div className="space-y-5 px-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Partida</h1>
        <span className="rounded-full border border-primary/40 bg-accent px-3 py-1 text-xs text-accent-foreground">{statusLabel[m.status] ?? m.status}</span>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between text-center">
          <div className="flex-1"><p className="font-display text-lg">{m.creator_nick}</p><p className="text-xs text-muted-foreground">criador</p></div>
          <p className="font-display text-3xl text-primary text-glow">VS</p>
          <div className="flex-1"><p className="font-display text-lg">{m.opponent_nick ?? "???"}</p><p className="text-xs text-muted-foreground">desafiante</p></div>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">Prêmio para o vencedor: <span className="font-display text-primary">{brl(prizeFor(Number(m.stake)))}</span></p>
      </div>

      <MatchCard m={m} />

      {m.status === "open" && user.id === m.creator_id && (
        <div className="space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
          <p className="font-display">Convide seu adversário</p>
          <Button asChild variant="neon" size="xl" className="w-full">
            <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><Share2 />Compartilhar no WhatsApp</a>
          </Button>
          <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}><Copy />Copiar link</Button>
          <Button variant="ghost" className="w-full text-destructive" onClick={() => cancel.mutate()}>Cancelar sala</Button>
        </div>
      )}

      {m.status === "open" && user.id !== m.creator_id && (
        <Button variant="neon" size="xl" className="w-full" disabled={accept.isPending} onClick={() => accept.mutate()}>Aceitar Desafio • {brl(m.stake)}</Button>
      )}

      {isPlayer && (m.status === "live" || m.status === "review") && (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Joguem a partida e o vencedor envia o print da tela de vitória.</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
          {myProof ? (
            <p className="rounded-xl bg-accent p-3 text-center text-sm text-accent-foreground">Seu print foi enviado • {myProof.status === "pending" ? "em análise" : myProof.status === "rejected" ? "recusado" : "aprovado"}</p>
          ) : null}
          {(!myProof || myProof.status === "rejected") && (
            <Button variant="neon" size="xl" className="w-full" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
              <Camera />{upload.isPending ? "Enviando..." : "Enviar Print da Vitória"}
            </Button>
          )}
        </div>
      )}

      {m.status === "finished" && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary bg-accent p-4 glow">
          <Trophy className="size-8 text-primary" />
          <p>{m.winner_id === user.id ? `Você venceu e recebeu ${brl(prizeFor(Number(m.stake)))}!` : `Vitória de ${m.winner_id === m.creator_id ? m.creator_nick : m.opponent_nick}.`}</p>
        </div>
      )}
    </div>
  );
}
