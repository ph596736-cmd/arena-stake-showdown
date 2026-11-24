import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { GAMES, brl, errMsg, prizeFor, type GameKey } from "@/lib/arena";

export const Route = createFileRoute("/_authenticated/criar")({
  head: () => ({ meta: [{ title: "Criar sala — Arena X1" }, { name: "description", content: "Crie um desafio 1v1." }, { property: "og:title", content: "Criar sala — Arena X1" }, { property: "og:description", content: "Crie um desafio 1v1." }] }),
  component: CreateRoom,
});

const QUICK: Record<GameKey, string[]> = {
  sinuca: ["Melhor de 3", "Mesa Londres", "Sem bola na caçapa chamada"],
  freefire: ["X1 de dedo", "Só M1014", "Melhor de 5 rounds", "Sem habilidade"],
  codm: ["Gunfight 1v1", "Só sniper", "Melhor de 3", "Sem scorestreak"],
};

function CreateRoom() {
  const [game, setGame] = useState<GameKey>("sinuca");
  const [stake, setStake] = useState("10");
  const [rules, setRules] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const value = Number(stake.replace(",", "."));

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_match", { _game: game, _stake: value, _rules: rules });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => { toast.success("Sala criada!"); qc.invalidateQueries({ queryKey: ["matches"] }); navigate({ to: "/partida/$id", params: { id } }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <form className="space-y-6 px-4 pt-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
      <h1 className="text-2xl font-bold">Criar sala</h1>
      <div className="space-y-2">
        <Label>Jogo</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(GAMES) as GameKey[]).map((k) => (
            <button type="button" key={k} onClick={() => setGame(k)}
              className={`rounded-xl border p-3 text-center ${game === k ? "border-primary bg-accent glow" : "bg-card"}`}>
              <div className="text-2xl">{GAMES[k].emoji}</div>
              <div className="mt-1 text-xs font-medium">{GAMES[k].label}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="stake">Valor da aposta (R$)</Label>
        <Input id="stake" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} className="h-12 text-lg" />
        <div className="flex gap-2">{[5, 10, 20, 50].map((v) => (
          <button type="button" key={v} onClick={() => setStake(String(v))} className="flex-1 rounded-lg border bg-secondary py-1.5 text-sm">R$ {v}</button>
        ))}</div>
        {value > 0 && <p className="text-sm text-muted-foreground">Vencedor recebe <span className="text-primary">{brl(prizeFor(value))}</span> (90% do pote)</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="rules">Regras rápidas</Label>
        <div className="flex flex-wrap gap-2">{QUICK[game].map((r) => (
          <button type="button" key={r} onClick={() => setRules((p) => (p ? `${p} • ${r}` : r))} className="rounded-full border bg-card px-3 py-1 text-xs">+ {r}</button>
        ))}</div>
        <Textarea id="rules" value={rules} onChange={(e) => setRules(e.target.value)} maxLength={500} placeholder="Ex: melhor de 3, sem emulador" />
      </div>
      <Button type="submit" variant="neon" size="xl" className="w-full" disabled={create.isPending}>Criar e gerar convite</Button>
      <p className="text-center text-xs text-muted-foreground">O valor é descontado quando alguém aceitar o desafio.</p>
    </form>
  );
}
