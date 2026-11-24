import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Search = { mode: "login" | "signup"; redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = { mode: s["mode"] === "signup" ? "signup" : "login" };
    if (typeof s["redirect"] === "string" && s["redirect"].startsWith("/")) out.redirect = s["redirect"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Entrar — Arena X1" },
      { name: "description", content: "Entre ou crie sua conta na Arena X1." },
      { property: "og:title", content: "Entrar — Arena X1" },
      { property: "og:description", content: "Entre ou crie sua conta na Arena X1." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const signup = mode === "signup";

  const go = () => navigate({ to: redirect ?? "/lobby", replace: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (signup) {
        if (nickname.trim().length < 3) throw new Error("Nickname precisa de pelo menos 3 letras");
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { nickname: nickname.trim() }, emailRedirectTo: window.location.origin + (redirect ?? "/lobby") },
        });
        if (error) throw error;
        if (data.session) go(); else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
        go();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-4xl font-bold">ARENA <span className="text-primary text-glow">X1</span></h1>
      <p className="mt-2 text-muted-foreground">{signup ? "Crie sua conta e comece com R$ 0,00 na carteira." : "Bem-vindo de volta, player."}</p>

      {sent ? (
        <div className="mt-8 rounded-xl border border-primary/40 bg-card p-5">
          <p className="font-display text-lg text-primary">Confirme seu e-mail</p>
          <p className="mt-1 text-sm text-muted-foreground">Enviamos um link para {email}. Clique nele para ativar sua conta.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          {signup && (
            <div className="space-y-1.5">
              <Label htmlFor="nick">Nickname</Label>
              <Input id="nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="SeuNick" required className="h-12" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Senha</Label>
            <Input id="pw" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
          </div>
          {signup && (
            <div className="flex items-center justify-between rounded-xl border bg-card p-4">
              <span className="text-sm text-muted-foreground">Saldo inicial na carteira</span>
              <span className="font-display text-lg text-primary">R$ 0,00</span>
            </div>
          )}
          <Button type="submit" variant="neon" size="xl" className="w-full" disabled={busy}>
            {busy ? "Aguarde..." : signup ? "Criar conta" : "Entrar"}
          </Button>
        </form>
      )}
      <button
        type="button"
        className="mt-6 text-sm text-muted-foreground hover:text-primary"
        onClick={() => { setSent(false); navigate({ to: "/auth", search: { mode: signup ? "login" : "signup", ...(redirect ? { redirect } : {}) } }); }}
      >
        {signup ? "Já tem conta? Entrar" : "Não tem conta? Cadastre-se"}
      </button>
    </main>
  );
}
