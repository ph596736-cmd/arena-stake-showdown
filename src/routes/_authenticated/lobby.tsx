import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/arena/MatchCard";
import { supabase } from "@/integrations/supabase/client";
import { GAMES, brl, errMsg, type GameKey } from "@/lib/arena";

export const Route = createFileRoute("/_authenticated/lobby")({
  head: () => ({ meta: [{ title: "Lobby — Arena X1" }, { name: "description", content: "Desafios abertos na Arena X1." }, { property: "og:title", content: "Lobby — Arena X1" }, { property: "og:description", content: "Desafios abertos na Arena X1." }] }),
  component: Lobby,
});

function Lobby() {
  const { user } = Route.useRouteContext();
  const [filter, setFilter] = useState<GameKey | "all">("all");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: open = [], isLoading } = useQuery({
    queryKey: ["matches", "open"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").eq("status", "open").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000,
  });
  const { data: mine = [] } = useQuery({
    queryKey: ["matches", "mine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*")
        .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`).in("status", ["open", "live", "review"]).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("accept_match", { _match_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      toast.success("Desafio aceito! Bora pro X1.");
      qc.invalidateQueries();
      navigate({ to: "/partida/$id", params: { id } });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const list = open.filter((m) => m.creator_id !== user.id && (filter === "all" || m.game === filter));
  const chip = (k: GameKey | "all", label: string) => (
    <button key={k} onClick={() => setFilter(k)}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${filter === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-5 px-4 pt-4">
      {mine.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">Minhas partidas</h2>
          <div className="space-y-2">
            {mine.map((m) => (
              <Link key={m.id} to="/partida/$id" params={{ id: m.id }} className="flex items-center justify-between rounded-xl border border-primary/30 bg-accent/40 px-4 py-3">
                <span>{GAMES[m.game as GameKey]?.emoji} {GAMES[m.game as GameKey]?.label} • {brl(m.stake)}</span>
                <span className="text-xs text-primary">{m.status === "open" ? "Aguardando" : m.status === "live" ? "Em jogo" : "Em análise"} →</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section>
        <h1 className="text-2xl font-bold">Desafios abertos</h1>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {chip("all", "Todos")}
          {(Object.keys(GAMES) as GameKey[]).map((k) => chip(k, `${GAMES[k].emoji} ${GAMES[k].label}`))}
        </div>
      </section>
      <div className="space-y-3">
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {!isLoading && list.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="text-muted-foreground">Nenhum desafio aberto agora.</p>
            <Button asChild variant="neon" className="mt-4"><Link to="/criar">Criar sala</Link></Button>
          </div>
        )}
        {list.map((m) => (
          <MatchCard key={m.id} m={m} action={
            <Button variant="neon" className="w-full" disabled={accept.isPending} onClick={() => accept.mutate(m.id)}>
              Aceitar Desafio
            </Button>
          } />
        ))}
      </div>
    </div>
  );
}
