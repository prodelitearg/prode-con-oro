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

interface Tournament { id: string; name: string; country: string | null; is_active: boolean }
interface Matchday { id: string; tournament_id: string; number: number; starts_at: string; entry_cost: number; prize_pool: number; is_open: boolean; closed_at: string | null; pot_carry: number }
interface Match { id: string; matchday_id: string; home_team: string; home_short: string; home_color: string; away_team: string; away_short: string; away_color: string; kickoff: string; home_score: number | null; away_score: number | null; status: string }

function Torneos() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selTour, setSelTour] = useState<string | null>(null);
  const [selMd, setSelMd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadTournaments = async () => {
    const { data, error } = await supabase.from("tournaments").select("*").order("name");
    if (error) return toast.error(error.message);
    setTournaments((data ?? []) as Tournament[]);
  };
  const reloadMatchdays = async (tid: string) => {
    const { data, error } = await supabase.from("matchdays").select("*").eq("tournament_id", tid).order("number");
    if (error) return toast.error(error.message);
    setMatchdays((data ?? []) as Matchday[]);
  };
  const reloadMatches = async (mdId: string) => {
    const { data, error } = await supabase.from("matches").select("*").eq("matchday_id", mdId).order("kickoff");
    if (error) return toast.error(error.message);
    setMatches((data ?? []) as Match[]);
  };

  useEffect(() => { void reloadTournaments().then(() => setLoading(false)); }, []);
  useEffect(() => { if (selTour) void reloadMatchdays(selTour); else setMatchdays([]); setSelMd(null); }, [selTour]);
  useEffect(() => { if (selMd) void reloadMatches(selMd); else setMatches([]); }, [selMd]);

  // ---------- Crear torneo ----------
  const [tName, setTName] = useState("");
  const [tCountry, setTCountry] = useState("");
  const createTournament = async (e: FormEvent) => {
    e.preventDefault();
    const name = tName.trim().slice(0, 80);
    if (!name) return toast.error("Nombre requerido");
    const { error } = await supabase.from("tournaments").insert({ name, country: tCountry.trim().slice(0, 60) || null, is_active: true });
    if (error) return toast.error(error.message);
    toast.success("Torneo creado");
    setTName(""); setTCountry("");
    void reloadTournaments();
  };
  const toggleTournament = async (t: Tournament) => {
    const { error } = await supabase.from("tournaments").update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) return toast.error(error.message);
    void reloadTournaments();
  };
  const deleteTournament = async (t: Tournament) => {
    if (!confirm(`Eliminar torneo "${t.name}" y todas sus fechas/partidos?`)) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    if (selTour === t.id) setSelTour(null);
    void reloadTournaments();
  };

  // ---------- Crear fecha ----------
  const [mdNumber, setMdNumber] = useState("");
  const [mdDate, setMdDate] = useState("");
  const [mdEntry, setMdEntry] = useState("30");
  const [mdPool, setMdPool] = useState("0");
  const createMatchday = async (e: FormEvent) => {
    e.preventDefault();
    if (!selTour) return toast.error("Seleccioná un torneo");
    const n = Number(mdNumber);
    if (!n || n < 1) return toast.error("Número inválido");
    if (!mdDate) return toast.error("Fecha requerida");
    const { error } = await supabase.from("matchdays").insert({
      tournament_id: selTour,
      number: n,
      starts_at: new Date(mdDate).toISOString(),
      entry_cost: Math.max(0, Number(mdEntry) || 0),
      prize_pool: Math.max(0, Number(mdPool) || 0),
      is_open: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Fecha creada");
    setMdNumber(""); setMdDate("");
    void reloadMatchdays(selTour);
  };
  const deleteMatchday = async (md: Matchday) => {
    if (!confirm(`Eliminar fecha ${md.number} y todos sus partidos?`)) return;
    const { error } = await supabase.from("matchdays").delete().eq("id", md.id);
    if (error) return toast.error(error.message);
    if (selMd === md.id) setSelMd(null);
    if (selTour) void reloadMatchdays(selTour);
  };

  // ---------- Crear partido ----------
  const [mHome, setMHome] = useState(""); const [mHomeShort, setMHomeShort] = useState(""); const [mHomeColor, setMHomeColor] = useState("#1e293b");
  const [mAway, setMAway] = useState(""); const [mAwayShort, setMAwayShort] = useState(""); const [mAwayColor, setMAwayColor] = useState("#1e293b");
  const [mKick, setMKick] = useState("");
  const createMatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!selMd) return toast.error("Seleccioná una fecha");
    if (!mHome.trim() || !mAway.trim()) return toast.error("Nombres de equipos requeridos");
    if (!mKick) return toast.error("Hora del partido requerida");
    const { error } = await supabase.from("matches").insert({
      matchday_id: selMd,
      home_team: mHome.trim().slice(0, 60), home_short: (mHomeShort || mHome).trim().toUpperCase().slice(0, 4), home_color: mHomeColor,
      away_team: mAway.trim().slice(0, 60), away_short: (mAwayShort || mAway).trim().toUpperCase().slice(0, 4), away_color: mAwayColor,
      kickoff: new Date(mKick).toISOString(),
      status: "scheduled",
    });
    if (error) return toast.error(error.message);
    toast.success("Partido creado");
    setMHome(""); setMHomeShort(""); setMAway(""); setMAwayShort(""); setMKick("");
    void reloadMatches(selMd);
  };
  const deleteMatch = async (m: Match) => {
    if (!confirm(`Eliminar ${m.home_team} vs ${m.away_team}?`)) return;
    const { error } = await supabase.from("matches").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    if (selMd) void reloadMatches(selMd);
  };
  const setResult = async (m: Match, h: string, a: string) => {
    const hs = h === "" ? null : Number(h); const as = a === "" ? null : Number(a);
    const status = hs !== null && as !== null ? "finished" : "scheduled";
    const { error } = await supabase.from("matches").update({ home_score: hs, away_score: as, status }).eq("id", m.id);
    if (error) return toast.error(error.message);
    if (selMd) void reloadMatches(selMd);
  };

  return (
    <>
      <div className="section-label !mt-0">Torneos</div>
      <form onSubmit={createTournament} className="card-base mb-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <input className="field-input" placeholder="Nombre del torneo" value={tName} onChange={(e) => setTName(e.target.value)} maxLength={80} />
        <input className="field-input" placeholder="País / región" value={tCountry} onChange={(e) => setTCountry(e.target.value)} maxLength={60} />
        <button type="submit" className="btn-gold !py-2">+ Crear</button>
      </form>
      {loading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {tournaments.map((t) => (
        <div key={t.id} className={`card-base flex items-center justify-between mb-2 !py-3 ${selTour === t.id ? "border-primary/60" : ""}`}>
          <button type="button" onClick={() => setSelTour(selTour === t.id ? null : t.id)} className="text-left flex-1">
            <div className="text-sm font-bold text-foreground">{t.name}</div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5">
              {t.country ?? "—"} · {t.is_active ? "Activo" : "Inactivo"}
            </div>
          </button>
          <div className="flex gap-1.5">
            <button type="button" className="btn-mini" onClick={() => toggleTournament(t)}>{t.is_active ? "Pausar" : "Activar"}</button>
            <button type="button" className="btn-mini is-danger" onClick={() => deleteTournament(t)}>Eliminar</button>
          </div>
        </div>
      ))}

      {selTour && (
        <>
          <div className="section-label">Fechas de {tournaments.find((x) => x.id === selTour)?.name}</div>
          <form onSubmit={createMatchday} className="card-base mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <input className="field-input" type="number" min={1} placeholder="Nº" value={mdNumber} onChange={(e) => setMdNumber(e.target.value)} />
            <input className="field-input col-span-1 sm:col-span-2" type="datetime-local" value={mdDate} onChange={(e) => setMdDate(e.target.value)} />
            <input className="field-input" type="number" min={0} placeholder="Entrada cr" value={mdEntry} onChange={(e) => setMdEntry(e.target.value)} />
            <input className="field-input" type="number" min={0} placeholder="Pozo cr" value={mdPool} onChange={(e) => setMdPool(e.target.value)} />
            <button type="submit" className="btn-gold !py-2 col-span-2 sm:col-span-5">+ Crear fecha</button>
          </form>
          {matchdays.length === 0 && <div className="text-sm text-muted-foreground mb-2">Sin fechas todavía.</div>}
          {matchdays.map((md) => (
            <div key={md.id} className={`card-base flex items-center justify-between mb-2 !py-3 ${selMd === md.id ? "border-primary/60" : ""}`}>
              <button type="button" onClick={() => setSelMd(selMd === md.id ? null : md.id)} className="text-left flex-1">
                <div className="text-sm font-bold text-foreground">Fecha {md.number}</div>
                <div className="text-[0.7rem] text-muted-foreground mt-0.5">
                  {new Date(md.starts_at).toLocaleString("es-AR")} · Entrada {md.entry_cost} cr · Pozo {md.prize_pool} cr
                </div>
              </button>
              <button type="button" className="btn-mini is-danger" onClick={() => deleteMatchday(md)}>Eliminar</button>
            </div>
          ))}
        </>
      )}

      {selMd && (
        <>
          <div className="section-label">Partidos de la fecha</div>
          <form onSubmit={createMatch} className="card-base mb-3 grid grid-cols-2 gap-2">
            <input className="field-input" placeholder="Local" value={mHome} onChange={(e) => setMHome(e.target.value)} maxLength={60} />
            <input className="field-input" placeholder="Visitante" value={mAway} onChange={(e) => setMAway(e.target.value)} maxLength={60} />
            <input className="field-input" placeholder="Sigla local (3-4)" value={mHomeShort} onChange={(e) => setMHomeShort(e.target.value)} maxLength={4} />
            <input className="field-input" placeholder="Sigla visitante (3-4)" value={mAwayShort} onChange={(e) => setMAwayShort(e.target.value)} maxLength={4} />
            <label className="text-[0.7rem] text-muted-foreground flex items-center gap-2">Color local <input type="color" value={mHomeColor} onChange={(e) => setMHomeColor(e.target.value)} /></label>
            <label className="text-[0.7rem] text-muted-foreground flex items-center gap-2">Color visitante <input type="color" value={mAwayColor} onChange={(e) => setMAwayColor(e.target.value)} /></label>
            <input className="field-input col-span-2" type="datetime-local" value={mKick} onChange={(e) => setMKick(e.target.value)} />
            <button type="submit" className="btn-gold !py-2 col-span-2">+ Crear partido</button>
          </form>
          {matches.length === 0 && <div className="text-sm text-muted-foreground mb-2">Sin partidos todavía.</div>}
          {matches.map((m) => (
            <div key={m.id} className="card-base mb-2 !py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-foreground flex-1">
                  {m.home_team} <span className="text-muted-foreground">vs</span> {m.away_team}
                </div>
                <button type="button" className="btn-mini is-danger" onClick={() => deleteMatch(m)}>×</button>
              </div>
              <div className="text-[0.7rem] text-muted-foreground mt-1 mb-2">
                {new Date(m.kickoff).toLocaleString("es-AR")} · {m.status}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[0.7rem] text-muted-foreground">Resultado:</span>
                <input
                  className="field-input !w-14 text-center !py-1" type="number" min={0} max={99}
                  defaultValue={m.home_score ?? ""}
                  onBlur={(e) => setResult(m, e.target.value, String(m.away_score ?? ""))}
                />
                <span>-</span>
                <input
                  className="field-input !w-14 text-center !py-1" type="number" min={0} max={99}
                  defaultValue={m.away_score ?? ""}
                  onBlur={(e) => setResult(m, String(m.home_score ?? ""), e.target.value)}
                />
              </div>
            </div>
          ))}
        </>
      )}
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
