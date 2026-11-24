import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

export const ADMIN_EMAIL = "ph596736@gmail.com";
export const HOUSE_FEE = 0.1;
export const MIN_WITHDRAW = 10;

export const GAMES = {
  sinuca: { label: "Sinuca", full: "8 Ball Pool", emoji: "🎱" },
  freefire: { label: "Free Fire", full: "Free Fire", emoji: "🔥" },
  codm: { label: "COD Mobile", full: "Call of Duty Mobile", emoji: "🎯" },
} as const;
export type GameKey = keyof typeof GAMES;

export const brl = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Prize paid to the winner: 90% of the pot (both stakes). */
export const prizeFor = (stake: number) => Math.round(stake * 2 * (1 - HOUSE_FEE) * 100) / 100;

export const errMsg = (e: unknown) =>
  (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Erro inesperado");

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).single();
    if (error) throw error;
    return data;
  },
});
