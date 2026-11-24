import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Swords, Wallet, Plus, Shield, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL, brl, profileQuery } from "@/lib/arena";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "login", redirect: location.href } });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useQuery(profileQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = user.email === ADMIN_EMAIL;

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const tab = "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground";
  const active = { className: "text-primary" };

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/lobby" className="font-display text-xl font-bold">ARENA <span className="text-primary text-glow">X1</span></Link>
        <div className="flex items-center gap-2">
          <Link to="/carteira" className="rounded-full border border-primary/40 bg-accent px-3 py-1 font-display text-sm text-accent-foreground">
            {brl(profile?.balance ?? 0)}
          </Link>
          <button onClick={logout} aria-label="Sair" className="p-2 text-muted-foreground hover:text-foreground"><LogOut className="size-4" /></button>
        </div>
      </header>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-end border-t bg-card/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur">
        <Link to="/lobby" className={tab} activeProps={active}><Swords className="size-5" />Lobby</Link>
        <Link to="/criar" className="-mt-6 flex flex-1 justify-center" aria-label="Criar sala">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground glow"><Plus className="size-7" /></span>
        </Link>
        <Link to="/carteira" className={tab} activeProps={active}><Wallet className="size-5" />Carteira</Link>
        {isAdmin && <Link to="/admin" className={tab} activeProps={active}><Shield className="size-5" />Admin</Link>}
      </nav>
    </div>
  );
}
