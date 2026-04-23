import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — PRODELITE" },
      { name: "description", content: "Tus datos, historial y link de referidos." },
    ],
  }),
  component: PerfilPage,
});

interface PayoutRow {
  id: string;
  base_prize: number;
  ranking_prize: number;
  rank_position: number | null;
  created_at: string;
  matchdays: {
    number: number;
    starts_at: string;
    closed_at: string | null;
    tournaments: { name: string } | null;
  } | null;
}

const RANK_LABEL = (n: number | null) => {
  if (!n) return "";
  return `${n}°`;
};

function PerfilPage() {
  const { user, profile, credits, signOut } = useAuth();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("matchday_payouts")
        .select(
          "id, base_prize, ranking_prize, rank_position, created_at, matchdays(number, starts_at, closed_at, tournaments(name))",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        console.error(error);
      } else {
        setPayouts((data ?? []) as unknown as PayoutRow[]);
      }
      setLoading(false);
    };
    void load();
  }, [user]);

  const initials =
    ((profile?.nombre?.[0] ?? "") + (profile?.apellido?.[0] ?? "")).toUpperCase() || "JG";
  const fullName = `${profile?.nombre ?? ""} ${profile?.apellido ?? ""}`.trim() || "Jugador";
  const total = (credits?.retirables ?? 0) + (credits?.bonus ?? 0);
  const refCode = profile?.ref_code ?? "—";

  const handleLogout = async () => {
    await signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/" });
  };

  const copyRef = async () => {
    const url = `${window.location.origin}/ref/${refCode}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="app-wrap">
      <div className="card-elevated text-center">
        <div
          className="mx-auto mb-3 h-[4.25rem] w-[4.25rem] rounded-full flex items-center justify-center font-display text-2xl font-extrabold text-primary"
          style={{
            background: "oklch(0.80 0.155 88 / 0.10)",
            border: "3px solid oklch(0.80 0.155 88 / 0.40)",
            boxShadow: "0 0 20px oklch(0.80 0.155 88 / 0.20)",
          }}
        >
          {initials}
        </div>
        <h1 className="font-display text-xl font-extrabold tracking-wider uppercase">{fullName}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {profile?.localidad || "—"}{profile?.provincia ? `, ${profile.provincia}` : ""}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="stat-box">
            <div className="font-display text-xl font-extrabold text-primary">{total}</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Créditos</div>
          </div>
          <div className="stat-box">
            <div className="font-display text-xl font-extrabold text-primary">
              {payouts.reduce((s, p) => s + p.base_prize + p.ranking_prize, 0)}
            </div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Ganados</div>
          </div>
          <div className="stat-box">
            <div className="font-display text-xl font-extrabold text-primary">{payouts.length}</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Fechas</div>
          </div>
        </div>
      </div>

      <h2 className="section-label">Premios por fecha</h2>

      {loading && <div className="text-sm text-muted-foreground">Cargando historial…</div>}

      {!loading && payouts.length === 0 && (
        <div className="card-base text-center !py-6">
          <div className="text-3xl mb-2">🏆</div>
          <div className="text-sm text-muted-foreground">
            Todavía no ganaste premios. Cuando se cierre una fecha donde participaste, vas a ver acá tu desglose.
          </div>
        </div>
      )}

      {!loading &&
        payouts.map((p) => {
          const liga = p.matchdays?.tournaments?.name ?? "—";
          const fechaNum = p.matchdays?.number ?? "?";
          const closedAt = p.matchdays?.closed_at;
          const total = p.base_prize + p.ranking_prize;
          return (
            <div key={p.id} className="card-base !py-3 mb-2">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase font-semibold truncate">
                    {liga}
                  </div>
                  <div className="text-sm font-bold text-foreground mt-0.5">Fecha {fechaNum}</div>
                  {closedAt && (
                    <div className="text-[0.65rem] text-muted-foreground mt-0.5">
                      Cerrada {new Date(closedAt).toLocaleDateString("es-AR")}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-lg font-extrabold text-success">+{total} cr</div>
                  <span className="tag tag-success mt-1 inline-block">✓ retirable</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div
                  className="rounded-lg px-3 py-2"
                  style={{ background: "oklch(0.22 0.03 250 / 0.5)", border: "1px solid oklch(0.30 0.03 250 / 0.4)" }}
                >
                  <div className="text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">
                    Premio aciertos
                  </div>
                  <div className="font-display text-base font-extrabold text-foreground mt-0.5">
                    {p.base_prize > 0 ? `+${p.base_prize} cr` : "—"}
                  </div>
                </div>
                <div
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: p.ranking_prize > 0 ? "oklch(0.80 0.155 88 / 0.10)" : "oklch(0.22 0.03 250 / 0.5)",
                    border: p.ranking_prize > 0
                      ? "1px solid oklch(0.80 0.155 88 / 0.40)"
                      : "1px solid oklch(0.30 0.03 250 / 0.4)",
                  }}
                >
                  <div className="text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">
                    Pozo top 5 {p.rank_position ? `· ${RANK_LABEL(p.rank_position)}` : ""}
                  </div>
                  <div className={`font-display text-base font-extrabold mt-0.5 ${p.ranking_prize > 0 ? "text-primary" : "text-foreground"}`}>
                    {p.ranking_prize > 0 ? `+${p.ranking_prize} cr` : "—"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

      <h2 className="section-label">Mi link de referidos</h2>
      <button
        type="button"
        onClick={copyRef}
        className="card-base w-full text-left hover:border-primary/40 transition-colors"
      >
        <div className="text-xs text-muted-foreground">Compartí y ganá créditos retirables</div>
        <div className="font-display text-sm font-bold text-primary mt-1 truncate">
          {typeof window !== "undefined" ? window.location.host : "prodelite.com"}/ref/{refCode}
        </div>
        <div className="text-[0.65rem] text-muted-foreground mt-1">Tocá para copiar</div>
      </button>

      <button type="button" className="btn-outline mt-5" onClick={handleLogout}>
        Cerrar sesión
      </button>
    </div>
  );
}
