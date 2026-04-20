import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/prodelite/Logo";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Panel Admin — PRODELITE" },
      { name: "description", content: "Panel de administración de afiliados, retiros y comisiones." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw redirect({ to: "/login-admin", search: { redirect: location.href } as never });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.session.user.id);
    const set = new Set((roles ?? []).map((r) => r.role));
    if (!set.has("admin") && !set.has("superadmin")) {
      throw redirect({ to: "/login-admin" });
    }
  },
  component: AdminPanel,
});

const TABS = ["dashboard", "afiliados", "retiros", "comisiones"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  dashboard: "Panel",
  afiliados: "Afiliados",
  retiros: "Retiros",
  comisiones: "Comisiones",
};

function AdminPanel() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/" });
  };

  return (
    <>
      <header className="app-header">
        <button type="button" onClick={handleLogout} className="btn-mini">
          ← Salir
        </button>
        <div className="absolute left-1/2 -translate-x-1/2">
          <Logo size="sm" />
        </div>
        <span className="tag tag-gold">Admin</span>
      </header>

      <div className="app-wrap">
        <div className="text-sm text-muted-foreground mb-3">
          Sesión activa: <strong className="text-foreground">{profile?.nombre} {profile?.apellido}</strong>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar -mx-2 px-2">
          {TABS.map((t) => (
            <button key={t} className={`btn-mini ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {tab === "dashboard" && <DashTab />}
        {tab === "afiliados" && <AfiliadosTab />}
        {tab === "retiros" && <RetirosTab />}
        {tab === "comisiones" && <ComisionesTab />}
      </div>
    </>
  );
}

function DashTab() {
  const stats = [
    { v: "28", l: "Afiliados" },
    { v: "4", l: "Retiros pend." },
    { v: "12%", l: "Comisión" },
    { v: "3.240", l: "Cr. ganados" },
  ];
  return (
    <>
      <div className="section-label !mt-0">Resumen</div>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {stats.map((s) => (
          <div key={s.l} className="card-base text-center">
            <div className="font-display text-2xl font-extrabold text-primary">{s.v}</div>
            <div className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase mt-1">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="card-base flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-foreground">Tu nivel</div>
          <div className="text-xs text-muted-foreground mt-0.5">28 afiliados · Comisión 12%</div>
        </div>
        <span className="tag tag-gold">Nivel Oro ★</span>
      </div>
    </>
  );
}

function AfiliadosTab() {
  const demo = [
    { n: "Juan García", loc: "San Rafael, Mendoza", ret: 818, bonus: 200, status: "activo" },
    { n: "Claudia López", loc: "Casilda, Santa Fe", ret: 1250, bonus: 0, status: "retiro pend." },
    { n: "Andrés Pérez", loc: "Mendoza Capital", ret: 80, bonus: 80, status: "activo" },
  ];
  return (
    <>
      <div className="section-label !mt-0">Mis afiliados</div>
      {demo.map((a, i) => (
        <div key={i} className="card-base flex items-center justify-between mb-2 !py-3">
          <div>
            <div className="text-sm font-bold text-foreground">{a.n}</div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5">{a.loc}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-sm font-extrabold text-success">{a.ret} cr ret.</div>
            {a.bonus > 0 && <div className="text-[0.7rem] font-bold text-warning mt-0.5">{a.bonus} cr bonus</div>}
            <span className={`tag mt-1 inline-block ${a.status === "activo" ? "tag-success" : "tag-warning"}`}>
              {a.status}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

function RetirosTab() {
  const demo = [
    { n: "Claudia López", cr: 1250, ars: "$62.500", fecha: "Hoy 14:32", alias: "claudia.mp" },
    { n: "Andrés Pérez", cr: 500, ars: "$25.000", fecha: "Ayer 09:15", alias: "andres.perez22" },
  ];
  return (
    <>
      <div className="section-label !mt-0">Solicitudes de retiro</div>
      {demo.map((r, i) => (
        <div key={i} className="card-base mb-3">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="text-sm font-bold text-foreground">{r.n}</div>
              <div className="text-[0.7rem] text-muted-foreground mt-0.5">{r.fecha}</div>
              <div className="text-[0.7rem] text-muted-foreground">Alias MP: {r.alias}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-base font-extrabold text-primary">{r.ars}</div>
              <div className="text-[0.7rem] text-muted-foreground mt-0.5">{r.cr} cr retirables</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-mini">Aprobar y pagar</button>
            <button type="button" className="btn-mini is-danger">Rechazar</button>
          </div>
        </div>
      ))}
    </>
  );
}

function ComisionesTab() {
  const demo = [
    { torneo: "Liga Profesional F14", jugadores: 28, comision: "100 cr", fecha: "17 May" },
    { torneo: "Champions Jornada 6", jugadores: 15, comision: "63 cr", fecha: "16 May" },
  ];
  return (
    <>
      <div className="section-label !mt-0">Mis comisiones (solo créditos retirables)</div>
      {demo.map((c, i) => (
        <div key={i} className="card-base flex items-center justify-between mb-2 !py-3">
          <div>
            <div className="text-[0.7rem] text-muted-foreground">{c.fecha}</div>
            <div className="text-sm font-bold text-foreground mt-0.5">{c.torneo}</div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5">{c.jugadores} jugadores</div>
          </div>
          <div className="text-right">
            <div className="font-display text-base font-extrabold text-primary">{c.comision}</div>
            <span className="tag tag-success mt-1 inline-block">✓ retirable</span>
          </div>
        </div>
      ))}
    </>
  );
}
