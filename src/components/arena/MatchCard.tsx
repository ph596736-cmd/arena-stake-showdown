import { GAMES, brl, prizeFor, type GameKey } from "@/lib/arena";
import type { ReactNode } from "react";

export function MatchCard({ m, action }: { m: { game: string; stake: number; creator_nick: string; rules: string | null }; action?: ReactNode }) {
  const g = GAMES[m.game as GameKey];
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-2xl">{g?.emoji}</span>
          <div>
            <p className="font-display font-semibold">{g?.label}</p>
            <p className="text-xs text-muted-foreground">por <span className="text-foreground">{m.creator_nick}</span></p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-xl text-primary text-glow">{brl(m.stake)}</p>
          <p className="text-[11px] text-muted-foreground">prêmio {brl(prizeFor(Number(m.stake)))}</p>
        </div>
      </div>
      {m.rules && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{m.rules}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
