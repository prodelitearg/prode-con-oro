import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — PRODELITE" },
      { name: "description", content: "Tus datos, historial y link de referidos." },
    ],
  }),
  component: PerfilPage,
});

const HISTORIAL = [
  { liga: "Liga Profesional", fecha: "Fecha 14", cr: "+225 cr", positive: true, sub: "Pozo ranking 3°", retirable: true },
  { liga: "Champions League", fecha: "Jornada 6", cr: "+18 cr", positive: true, sub: "Premio base aciertos", retirable: true },
  { liga: "Liga Profesional", fecha: "Fecha 13", cr: "-30 cr", positive: false, sub: "Entrada a fecha", retirable: false },
  { liga: "Referido", fecha: "María G. se unió", cr: "+10 cr", positive: true, sub: "Bono por referido", retirable: true },
];

function PerfilPage() {
  const { profile, credits, signOut } = useAuth();
  const navigate = useNavigate();

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
    const url = `${window.location.origin}/register?ref=${refCode}`;
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
            <div className="font-display text-xl font-extrabold text-primary">38%</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Precisión</div>
          </div>
          <div className="stat-box">
            <div className="font-display text-xl font-extrabold text-primary">7°</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Ranking</div>
          </div>
        </div>
      </div>

      <h2 className="section-label">Historial</h2>
      {HISTORIAL.map((h, i) => (
        <div
          key={i}
          className="card-base flex justify-between items-center !py-3 mb-2"
        >
          <div>
            <div className="text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase font-semibold">
              {h.liga}
            </div>
            <div className="text-sm font-bold text-foreground mt-0.5">{h.fecha}</div>
          </div>
          <div className="text-right">
            <div className={`font-display text-base font-extrabold ${h.positive ? "text-success" : "text-destructive"}`}>
              {h.cr}
            </div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5">{h.sub}</div>
            {h.retirable && <span className="tag tag-success mt-1 inline-block">✓ retirable</span>}
          </div>
        </div>
      ))}

      <h2 className="section-label">Mi link de referidos</h2>
      <button
        type="button"
        onClick={copyRef}
        className="card-base w-full text-left hover:border-primary/40 transition-colors"
      >
        <div className="text-xs text-muted-foreground">Compartí y ganá créditos retirables</div>
        <div className="font-display text-sm font-bold text-primary mt-1 truncate">
          prodelite.com/ref/{refCode}
        </div>
        <div className="text-[0.65rem] text-muted-foreground mt-1">Tocá para copiar</div>
      </button>

      <button type="button" className="btn-outline mt-5" onClick={handleLogout}>
        Cerrar sesión
      </button>
    </div>
  );
}
