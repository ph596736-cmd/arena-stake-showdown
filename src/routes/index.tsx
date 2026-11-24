import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { QrCode, Lock, ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GAMES } from "@/lib/arena";
import hero from "@/assets/arena-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arena X1 — Seu jogo. Seu dinheiro." },
      { name: "description", content: "Desafie qualquer um no X1 em Sinuca, Free Fire e COD Mobile e receba o prêmio via Pix." },
      { property: "og:title", content: "Arena X1 — Seu jogo. Seu dinheiro." },
      { property: "og:description", content: "Desafios 1v1 valendo dinheiro em Sinuca, Free Fire e COD Mobile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const PERKS = [
  { icon: QrCode, label: "Depósito via Pix" },
  { icon: Lock, label: "Aposta retida" },
  { icon: ScanEye, label: "Print revisado" },
];

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/lobby", replace: true });
    });
  }, [navigate]);

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden bg-void">
      <div className="relative h-[46vh] min-h-72">
        <img src={hero} alt="Jogadores de e-sports em fumaça neon" width={1024} height={1024} className="absolute inset-0 size-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-void/40 to-void" />
      </div>
      <div className="relative -mt-20 flex flex-1 flex-col px-6 pb-8 text-center">
        <h1 className="font-display text-6xl font-black leading-none tracking-tight text-foreground">
          ARENA <span className="text-neon text-glow">X1</span>
        </h1>
        <p className="mt-3 font-display text-lg font-bold tracking-[0.2em] text-cyan">SEU JOGO. SEU DINHEIRO.</p>
        <p className="mt-3 text-sm text-muted-foreground">Desafie qualquer um no X1, aposte de R$ 5 a R$ 1.000 e leve o prêmio direto na carteira.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {Object.values(GAMES).map((g) => (
            <span key={g.full} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold">
              <span>{g.emoji}</span>{g.full === "Call of Duty Mobile" ? "COD Mobile" : g.full}
            </span>
          ))}
        </div>
        <div className="mt-8 space-y-3">
          <Button asChild variant="neon" size="xl" className="w-full font-black">
            <Link to="/auth" search={{ mode: "signup" }}>CRIAR CONTA GRÁTIS</Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full bg-card font-bold uppercase">
            <Link to="/auth" search={{ mode: "login" }}>JÁ TENHO CONTA</Link>
          </Button>
        </div>
        <div className="mt-auto grid grid-cols-3 gap-2 pt-10">
          {PERKS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-5 text-primary" strokeWidth={1.5} />{label}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground">Vencedor leva 90% do pote. +18.</p>
      </div>
    </main>
  );
}
