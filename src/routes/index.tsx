import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GAMES } from "@/lib/arena";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arena X1 — Aposte no seu X1" },
      { name: "description", content: "Crie ou aceite desafios 1v1 em Sinuca, Free Fire e COD Mobile e receba o prêmio via Pix." },
      { property: "og:title", content: "Arena X1 — Aposte no seu X1" },
      { property: "og:description", content: "Desafios 1v1 valendo dinheiro em Sinuca, Free Fire e COD Mobile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/lobby", replace: true });
    });
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <div className="grid-bg absolute inset-0 -z-10 opacity-40" />
      <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">1 vs 1 • valendo Pix</p>
      <h1 className="mt-3 text-6xl font-bold leading-none">
        ARENA <span className="text-primary text-glow">X1</span>
      </h1>
      <p className="mt-4 text-muted-foreground">Desafie, jogue, mande o print e receba o prêmio direto na carteira.</p>
      <div className="mt-10 space-y-3">
        {Object.values(GAMES).map((g) => (
          <div key={g.label} className="flex items-center gap-4 rounded-xl border bg-card/70 p-4">
            <span className="text-3xl">{g.emoji}</span>
            <div>
              <p className="font-display text-lg font-semibold">{g.label}</p>
              <p className="text-xs text-muted-foreground">{g.full}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto space-y-3 pt-10">
        <Button asChild variant="neon" size="xl" className="w-full">
          <Link to="/auth" search={{ mode: "signup" }}>Criar conta</Link>
        </Button>
        <Button asChild variant="outline" size="xl" className="w-full">
          <Link to="/auth" search={{ mode: "login" }}>Já tenho conta</Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">Vencedor leva 90% do pote. +18.</p>
      </div>
    </main>
  );
}
