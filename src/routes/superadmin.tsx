import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/prodelite/Logo";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/superadmin")({
  head: () => ({
    meta: [
      { title: "Panel Superadmin — PRODELITE" },
      { name: "description", content: "Panel de control general del sistema PRODELITE." },
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
    if (!set.has("superadmin")) throw redirect({ to: "/login-admin" });
  },
  component: SuperPanel,
});

const TABS = ["dashboard", "admins", "torneos", "usuarios", "finanzas"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = {
  dashboard: "Panel",
  admins: "Admins",
  torneos: "Torneos",
  usuarios: "Usuarios",
  finanzas: "Finanzas",
};

function SuperPanel() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const navigate = useNavigate();
  const { signOut } = useAuth();

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
        <span className="tag tag-danger">Superadmin</span>
      </header>

      <div className="app-wrap">
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar -mx-2 px-2">
          {TABS.map((t) => (
            <button key={t} className={`btn-mini ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
              {LABEL[t]}
            </button>
          ))}
        </div>

        {tab === "dashboard" && <Dash />}
        {tab === "admins" && <Admins />}
        {tab === "torneos" && <Torneos />}
        {tab === "usuarios" && <Usuarios />}
        {tab === "finanzas" && <Finanzas />}
      </div>
    </>
  );
}

function Dash() {
  const stats = [
    { v: "2.417", l: "Usuarios" },
    { v: "48", l: "Admins" },
    { v: "6", l: "Torneos" },
    { v: "$1.2M", l: "Ingresos mes" },
    { v: "12", l: "Retiros pend." },
    { v: "23k", l: "Cr. circulación" },
  ];
  return (
    <>
      <div className="section-label !mt-0">Resumen general</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
        {stats.map((s) => (
          <div key={s.l} className="card-base text-center !p-3">
            <div className="font-display text-xl font-extrabold text-primary">{s.v}</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-1">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="section-label">Estado del sistema</div>
      <div className="card-base">
        {[
          { k: "API deportiva", v: "Online" },
          { k: "Base de datos", v: "Operativa" },
          { k: "Mercado Pago", v: "Conectado" },
          { k: "Último backup", v: "Hace 2 horas" },
        ].map((s, i, arr) => (
          <div
            key={s.k}
            className={`flex justify-between py-2.5 ${i < arr.length - 1 ? "border-b border-border/40" : ""}`}
          >
            <span className="text-sm text-muted-foreground">{s.k}</span>
            <span className="text-sm text-success font-semibold">{s.v}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Admins() {
  const demo = [
    { n: "Carlos Méndez", loc: "San Rafael, Mendoza", afil: 28, nivel: "Oro", com: "12%" },
    { n: "Lucía Torres", loc: "Casilda, Santa Fe", afil: 14, nivel: "Plata", com: "10%" },
    { n: "Rodrigo Vega", loc: "Mendoza Capital", afil: 6, nivel: "Bronce", com: "8%" },
  ];
  return (
    <>
      <div className="section-label !mt-0">Administradores</div>
      <button className="btn-outline mb-3" type="button">+ Nuevo administrador</button>
      {demo.map((a, i) => (
        <div key={i} className="card-base flex items-center justify-between mb-2 !py-3">
          <div>
            <div className="text-sm font-bold text-foreground">{a.n}</div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5">
              {a.loc} · {a.afil} afiliados · {a.nivel} · {a.com}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button type="button" className="btn-mini">Ver</button>
            <button type="button" className="btn-mini is-danger">Suspender</button>
          </div>
        </div>
      ))}
    </>
  );
}

function Torneos() {
  const demo = [
    { n: "Liga Profesional Argentina", actual: 14, total: 27, jugadores: 284, pozo: 8520 },
    { n: "Champions League", actual: 6, total: 8, jugadores: 162, pozo: 4860 },
    { n: "Copa Libertadores", actual: 4, total: 6, jugadores: 94, pozo: 2820 },
  ];
  return (
    <>
      <div className="section-label !mt-0">Torneos activos</div>
      <button className="btn-outline mb-3" type="button">+ Crear torneo / liga</button>
      {demo.map((t, i) => (
        <div key={i} className="card-base flex items-center justify-between mb-2 !py-3">
          <div>
            <div className="text-sm font-bold text-foreground">{t.n}</div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5">
              Fecha {t.actual}/{t.total} · {t.jugadores} jugadores · Pozo: {t.pozo} cr
            </div>
          </div>
          <div className="flex gap-1.5">
            <button type="button" className="btn-mini">Editar</button>
            <button type="button" className="btn-mini">Resultados</button>
          </div>
        </div>
      ))}
    </>
  );
}

function Usuarios() {
  const demo = [
    { n: "Juan García", dni: "32.145.678", admin: "Carlos M.", ret: 818, bonus: 200, status: "activo" },
    { n: "Claudia López", dni: "28.901.234", admin: "Carlos M.", ret: 1250, bonus: 0, status: "retiro pend." },
    { n: "Patricia Gómez", dni: "29.012.345", admin: "Rodrigo V.", ret: 0, bonus: 80, status: "sin retirables" },
  ];
  return (
    <>
      <div className="section-label !mt-0">Usuarios registrados</div>
      {demo.map((u, i) => (
        <div key={i} className="card-base flex items-center justify-between mb-2 !py-3">
          <div>
            <div className="text-sm font-bold text-foreground">{u.n}</div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5">DNI {u.dni} · Admin: {u.admin}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-xs font-extrabold text-success">{u.ret} cr ret.</div>
            <div className="font-display text-xs font-bold text-warning mt-0.5">{u.bonus} cr bonus</div>
            <span
              className={`tag mt-1 inline-block ${
                u.status === "activo" ? "tag-success" : u.status.includes("retiro") ? "tag-warning" : "tag-danger"
              }`}
            >
              {u.status}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

function Finanzas() {
  return (
    <>
      <div className="section-label !mt-0">Resumen financiero del mes</div>
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {[
          { v: "$1.23M", l: "Recaudado", c: "var(--primary)" },
          { v: "$735k", l: "Premiado", c: "var(--success)" },
          { v: "$369k", l: "Tu ganancia", c: "var(--primary)" },
          { v: "$122k", l: "Comisiones adm.", c: "var(--muted-foreground)" },
        ].map((s) => (
          <div key={s.l} className="card-base text-center !p-3">
            <div className="font-display text-xl font-extrabold" style={{ color: s.c }}>{s.v}</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-1">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="section-label">Retiros pendientes</div>
      {[
        { n: "Claudia López", admin: "Carlos M.", cr: 1250, ars: "$62.500" },
        { n: "Marcos Rodríguez", admin: "Lucía T.", cr: 800, ars: "$40.000" },
      ].map((r, i) => (
        <div key={i} className="card-base flex justify-between items-center mb-2 !py-3">
          <div>
            <div className="text-sm font-bold text-foreground">{r.n}</div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5">
              Admin: {r.admin} · {r.cr} cr retirables
            </div>
          </div>
          <div className="font-display text-base font-extrabold text-primary">{r.ars}</div>
        </div>
      ))}
    </>
  );
}
