import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/prodelite/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useServerFn } from "@tanstack/react-start";
import { syncMatchdayFromApi } from "@/server/sync-football";
import { promoteToAdminFn, promoteUserToAdminFn, revokeAdminFn } from "@/server/admins";

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

const TABS = ["dashboard", "sync", "admins", "torneos", "usuarios", "compras", "finanzas"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = {
  dashboard: "Panel",
  sync: "Sync API",
  admins: "Admins",
  torneos: "Torneos",
  usuarios: "Usuarios",
  compras: "Compras",
  finanzas: "Finanzas",
};

function SuperPanel() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [pendingPurchases, setPendingPurchases] = useState(0);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const loadPendingPurchases = async () => {
    const { count } = await supabase
      .from("credit_purchase_requests" as never)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingPurchases(count ?? 0);
  };

  useEffect(() => { void loadPendingPurchases(); }, []);

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
        <div className="flex items-center gap-2">
          <button type="button" className="btn-mini bell-pill" onClick={() => setTab("compras")} aria-label="Ver compras pendientes">
            🔔{pendingPurchases > 0 && <span>{pendingPurchases}</span>}
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/app/partidos" })}
            className="btn-mini"
            aria-label="Ir a jugar"
          >
            🎮 Jugar
          </button>
          <span className="tag tag-danger">Superadmin</span>
        </div>
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
        {tab === "sync" && <SyncApi />}
        {tab === "admins" && <Admins />}
        {tab === "torneos" && <Torneos />}
        {tab === "usuarios" && <Usuarios />}
        {tab === "compras" && <ComprasSuper onChanged={loadPendingPurchases} />}
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

interface SyncTournament { id: string; name: string; external_id: number | null }

function SyncApi() {
  const syncFn = useServerFn(syncMatchdayFromApi);
  const [tournaments, setTournaments] = useState<SyncTournament[]>([]);
  const [tid, setTid] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(in7);
  const [entryCost, setEntryCost] = useState("30");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id,name,external_id")
        .not("external_id", "is", null)
        .eq("is_active", true)
        .order("name");
      if (error) return toast.error(error.message);
      const list = (data ?? []) as SyncTournament[];
      setTournaments(list);
      if (list.length && !tid) setTid(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    if (!tid) return toast.error("Seleccioná una liga");
    setBusy(true);
    setLastResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setBusy(false);
        return toast.error("Sesión expirada, volvé a iniciar sesión");
      }
      const res = await syncFn({
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tournamentId: tid,
          fromDate: from,
          toDate: to,
          season: Number(season),
          entryCost: Number(entryCost) || 30,
        },
      });
      if (!res.ok) {
        const msg = res.error || "Error desconocido al sincronizar";
        toast.error(msg);
        setLastResult("❌ " + msg);
      } else {
        const msg = `✓ ${res.totalFixtures} partidos · ${res.createdMatchdays} fechas nuevas · ${res.upsertedMatches} partidos creados · ${res.updatedScores} resultados actualizados · Fechas: ${res.rounds.join(", ")}`;
        toast.success("Sincronización completa");
        setLastResult(msg);
      }
    } catch (e) {
      let msg: string;
      if (e instanceof Response) {
        msg = `${e.status}: ${await e.text().catch(() => e.statusText)}`;
      } else if (e instanceof Error) {
        msg = e.message;
      } else {
        msg = String(e);
      }
      toast.error("Error: " + msg);
      setLastResult("❌ " + msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="section-label !mt-0">Sincronizar partidos desde API-Football</div>
      <div className="card-base mb-3 text-[0.75rem] text-muted-foreground">
        Trae automáticamente las fechas y partidos de la liga seleccionada en el rango de días.
        Las ligas <strong className="text-foreground">Casildense</strong> y <strong className="text-foreground">Sanrafaelina</strong> se siguen cargando manualmente desde la pestaña <em>Torneos</em>.
      </div>

      <div className="card-base">
        <label className="field-label">Liga</label>
        <select className="field-input mb-3" value={tid} onChange={(e) => setTid(e.target.value)}>
          {tournaments.length === 0 && <option>Sin ligas con API vinculada</option>}
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="field-label">Temporada</label>
            <input
              className="field-input"
              type="number"
              min={2000}
              max={2100}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Entrada (cr)</label>
            <input
              className="field-input"
              type="number"
              min={0}
              value={entryCost}
              onChange={(e) => setEntryCost(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Desde</label>
            <input className="field-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Hasta</label>
            <input className="field-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <button
          type="button"
          className="btn-gold w-full !py-2.5"
          onClick={handleSync}
          disabled={busy || tournaments.length === 0}
        >
          {busy ? "Sincronizando…" : "↻ Sincronizar fixture y resultados"}
        </button>

        {lastResult && (
          <div className="mt-3 text-[0.75rem] text-foreground border-t border-border/40 pt-3 leading-relaxed">
            {lastResult}
          </div>
        )}
      </div>

      <div className="text-[0.7rem] text-muted-foreground mt-3 leading-relaxed">
        <strong className="text-foreground">Tip:</strong> usá rangos cortos (1-2 semanas) para no consumir muchos requests del plan gratis (100/día).
        La sincronización es idempotente: podés correrla varias veces sin duplicar partidos.
      </div>
    </>
  );
}

interface AdminRow {
  user_id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  provincia: string | null;
  localidad: string | null;
}

function Admins() {
  const promote = useServerFn(promoteToAdminFn);
  const revoke = useServerFn(revokeAdminFn);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const { data: roleRows, error: rErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (rErr) {
      toast.error(rErr.message);
      setLoading(false);
      return;
    }
    const ids = (roleRows ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setAdmins([]);
      setLoading(false);
      return;
    }
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("user_id,nombre,apellido,email,provincia,localidad")
      .in("user_id", ids);
    if (pErr) toast.error(pErr.message);
    setAdmins(((profs ?? []) as AdminRow[]).sort((a, b) =>
      `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
    ));
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  const handlePromote = async (e: FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!v) return toast.error("Ingresá un email");
    setBusy(true);
    try {
      const res = await promote({ data: { email: v } });
      if (res.alreadyAdmin) toast.info(`${res.email} ya era administrador`);
      else toast.success(`${res.email} promovido a administrador`);
      setEmail("");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (a: AdminRow) => {
    if (!confirm(`Quitar rol admin a ${a.nombre} ${a.apellido}?`)) return;
    try {
      await revoke({ data: { userId: a.user_id } });
      toast.success("Rol admin removido");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    }
  };

  return (
    <>
      <div className="section-label !mt-0">Crear administrador</div>
      <form onSubmit={handlePromote} className="card-base mb-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <input
          className="field-input"
          type="email"
          placeholder="Email del usuario a promover"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
          required
        />
        <button type="submit" className="btn-gold !py-2" disabled={busy}>
          {busy ? "Promoviendo…" : "+ Hacer admin"}
        </button>
      </form>
      <div className="text-[0.7rem] text-muted-foreground -mt-2 mb-3">
        El usuario debe estar registrado en la app. Buscamos por email exacto.
      </div>

      <div className="section-label">Administradores actuales ({admins.length})</div>
      {loading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {!loading && admins.length === 0 && (
        <div className="text-sm text-muted-foreground">Todavía no hay administradores.</div>
      )}
      {admins.map((a) => (
        <div key={a.user_id} className="card-base flex items-center justify-between mb-2 !py-3 gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground truncate">
              {a.nombre} {a.apellido}
            </div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5 truncate">
              {a.email ?? "—"} · {[a.localidad, a.provincia].filter(Boolean).join(", ") || "Sin ubicación"}
            </div>
          </div>
          <button type="button" className="btn-mini is-danger" onClick={() => handleRevoke(a)}>
            Quitar admin
          </button>
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
  const [resultDrafts, setResultDrafts] = useState<Record<string, { h: string; a: string }>>({});
  const [resultBusy, setResultBusy] = useState<string | null>(null);
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
    const rows = (data ?? []) as Match[];
    setMatches(rows);
    setResultDrafts(Object.fromEntries(rows.map((m) => [m.id, { h: String(m.home_score ?? ""), a: String(m.away_score ?? "") }])));
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

  const closeMatchday = async (md: Matchday) => {
    if (!confirm(`Cerrar fecha ${md.number} y distribuir el pozo? Esta acción es irreversible.`)) return;
    const { data, error } = await supabase.rpc("close_matchday", { _matchday_id: md.id });
    if (error) return toast.error(error.message);
    const r = (data ?? {}) as Record<string, number>;
    toast.success(
      `Fecha cerrada · ${r.players} jugadores · Recaudado ${r.total_collected} cr · ` +
      `Top5: ${r.top_total_distributed}/${(r.top_pool ?? 0) + (r.carry_in ?? 0)} cr` +
      (r.carried_to_next > 0 ? ` · Acumulado a próxima: ${r.carried_to_next} cr` : "")
    );
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
  const selectedMatchday = matchdays.find((md) => md.id === selMd) ?? null;
  const canCloseSelected = !!selectedMatchday && !selectedMatchday.closed_at && matches.length > 0 && matches.every((m) => m.status === "finished" && m.home_score !== null && m.away_score !== null);

  const confirmResult = async (m: Match) => {
    const draft = resultDrafts[m.id] ?? { h: "", a: "" };
    if (draft.h === "" || draft.a === "") return toast.error("Ingresá ambos goles");
    if (!confirm(`¿Confirmás el resultado ${m.home_team} ${draft.h} - ${draft.a} ${m.away_team}?`)) return;
    setResultBusy(m.id);
    const { data, error } = await supabase.rpc("confirm_match_result" as never, {
      _match_id: m.id,
      _home_score: Number(draft.h),
      _away_score: Number(draft.a),
    } as never);
    setResultBusy(null);
    if (error) return toast.error(error.message);
    const r = (data ?? {}) as { awarded?: number; players?: number };
    toast.success(`Resultado confirmado · ${r.players ?? 0} jugadores · ${r.awarded ?? 0} créditos acreditados`);
    if (selMd) void reloadMatches(selMd);
  };

  const editResult = async (m: Match) => {
    if (!confirm(`¿Editar resultado de ${m.home_team} vs ${m.away_team}? Se revertirán los premios base de este partido.`)) return;
    setResultBusy(m.id);
    const { data, error } = await supabase.rpc("reopen_match_result" as never, { _match_id: m.id } as never);
    setResultBusy(null);
    if (error) return toast.error(error.message);
    const r = (data ?? {}) as { reversed?: number };
    toast.success(`Resultado reabierto · ${r.reversed ?? 0} créditos revertidos`);
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
            <div key={md.id} className={`card-base flex items-center justify-between mb-2 !py-3 gap-2 ${selMd === md.id ? "border-primary/60" : ""}`}>
              <button type="button" onClick={() => setSelMd(selMd === md.id ? null : md.id)} className="text-left flex-1">
                <div className="text-sm font-bold text-foreground flex items-center gap-2">
                  Fecha {md.number}
                  {md.closed_at ? <span className="tag tag-success">Cerrada</span> : <span className="tag">Abierta</span>}
                  {md.pot_carry > 0 && <span className="tag tag-gold">+{md.pot_carry} cr acum.</span>}
                </div>
                <div className="text-[0.7rem] text-muted-foreground mt-0.5">
                  {new Date(md.starts_at).toLocaleString("es-AR")} · Entrada {md.entry_cost} cr · Pozo {md.prize_pool} cr
                </div>
              </button>
              {!md.closed_at && matches.length > 0 && selMd === md.id && matches.every((m) => m.status === "finished" && m.home_score !== null && m.away_score !== null) && (
                <button type="button" className="btn-mini" onClick={() => closeMatchday(md)}>Cerrar</button>
              )}
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
                {new Date(m.kickoff).toLocaleString("es-AR")} · {m.status === "finished" ? <span className="text-success font-bold">Finalizado</span> : <span>Pendiente</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {m.status === "finished" ? (
                  <>
                    <span className="font-display text-lg font-extrabold text-success">{m.home_score} - {m.away_score}</span>
                    {!selectedMatchday?.closed_at && <button type="button" className="btn-mini" disabled={resultBusy === m.id} onClick={() => editResult(m)}>Editar resultado</button>}
                  </>
                ) : (
                  <>
                    <span className="text-[0.7rem] text-muted-foreground">Resultado:</span>
                    <input className="field-input !w-14 text-center !py-1" type="number" min={0} max={99} value={resultDrafts[m.id]?.h ?? ""} onChange={(e) => setResultDrafts((s) => ({ ...s, [m.id]: { ...(s[m.id] ?? { h: "", a: "" }), h: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) } }))} />
                    <span>-</span>
                    <input className="field-input !w-14 text-center !py-1" type="number" min={0} max={99} value={resultDrafts[m.id]?.a ?? ""} onChange={(e) => setResultDrafts((s) => ({ ...s, [m.id]: { ...(s[m.id] ?? { h: "", a: "" }), a: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) } }))} />
                    <button type="button" className="btn-mini" disabled={resultBusy === m.id} onClick={() => confirmResult(m)}>Confirmar resultado</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {canCloseSelected && selectedMatchday && (
            <button type="button" className="btn-gold is-success mt-3" onClick={() => closeMatchday(selectedMatchday)}>
              Cerrar fecha y distribuir pozo
            </button>
          )}
        </>
      )}
    </>
  );
}

interface UsuarioRow {
  user_id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  email: string | null;
  provincia: string | null;
  localidad: string | null;
  created_at: string;
}

interface PurchaseReq {
  id: string;
  user_id: string;
  package_name: string;
  credits: number;
  bonus: number;
  amount_ars: number;
  receipt_url: string;
  status: string;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
  profile_name?: string;
}

function ComprasSuper({ onChanged }: { onChanged?: () => Promise<void> }) {
  const [items, setItems] = useState<PurchaseReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("credit_purchase_requests" as never)
      .select("id, user_id, package_name, credits, bonus, amount_ars, receipt_url, status, notes, created_at, processed_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error(error.message);
      setItems([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as PurchaseReq[];
    if (rows.length) {
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("user_id,nombre,apellido,email").in("user_id", ids);
      const map = new Map((profs ?? []).map((p) => [p.user_id, `${`${p.nombre} ${p.apellido}`.trim() || "Jugador"} · ${p.email ?? "sin email"}`]));
      setItems(rows.map((r) => ({ ...r, profile_name: map.get(r.user_id) ?? "Jugador · sin email" })));
    } else setItems([]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const viewReceipt = async (req: PurchaseReq) => {
    if (signedUrls[req.id]) return window.open(signedUrls[req.id], "_blank", "noopener");
    const { data, error } = await supabase.storage.from("credit-receipts").createSignedUrl(req.receipt_url, 300);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "No se pudo abrir el comprobante");
    setSignedUrls((s) => ({ ...s, [req.id]: data.signedUrl }));
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const resolve = async (id: string, approve: boolean) => {
    let notes: string | null = null;
    if (!approve) notes = (window.prompt("Motivo del rechazo (opcional):") ?? "").trim() || null;
    else if (!window.confirm("¿Confirmás que recibiste el pago y querés acreditar los créditos?")) return;
    setBusyId(id);
    const { error } = await supabase.rpc("resolve_credit_purchase" as never, { _request_id: id, _approve: approve, _notes: notes } as never);
    setBusyId(null);
    if (error) return toast.error(error.message ?? "No se pudo procesar");
    toast.success(approve ? "Compra acreditada" : "Compra rechazada");
    await load();
    await onChanged?.();
  };

  const pending = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending");

  return (
    <>
      <div className="section-label !mt-0">Compras pendientes ({pending.length})</div>
      {loading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {!loading && pending.length === 0 && <div className="card-base text-center !py-5 text-sm text-muted-foreground">No hay compras pendientes.</div>}
      {pending.map((p) => <PurchaseCard key={p.id} p={p} busyId={busyId} viewReceipt={viewReceipt} resolve={resolve} />)}
      <div className="section-label">Historial</div>
      {!loading && resolved.length === 0 && <div className="card-base text-center !py-5 text-sm text-muted-foreground">Sin compras resueltas.</div>}
      {resolved.map((p) => <PurchaseCard key={p.id} p={p} busyId={busyId} viewReceipt={viewReceipt} resolve={resolve} readonly />)}
    </>
  );
}

function PurchaseCard({ p, busyId, viewReceipt, resolve, readonly }: { p: PurchaseReq; busyId: string | null; viewReceipt: (p: PurchaseReq) => void; resolve: (id: string, approve: boolean) => void; readonly?: boolean }) {
  const label = p.status === "approved" ? "✓ Aprobada" : p.status === "rejected" ? "✗ Rechazada" : "Pendiente";
  const tag = p.status === "approved" ? "tag-success" : p.status === "rejected" ? "tag-warning" : "tag-gold";
  return (
    <div className="card-base mb-2 !py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{p.profile_name}</div>
          <div className="text-[0.7rem] text-muted-foreground mt-0.5">{new Date(p.created_at).toLocaleDateString("es-AR")} · {new Date(p.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="text-xs text-muted-foreground mt-1"><strong className="text-foreground">{p.package_name}</strong> · {p.credits} cr ret.{p.bonus > 0 && <> + <span className="text-warning">{p.bonus} bonus</span></>}</div>
          <span className={`tag ${tag} mt-2 inline-block`}>{label}</span>
        </div>
        <div className="text-right shrink-0"><div className="font-display text-lg font-extrabold text-primary">${p.amount_ars.toLocaleString("es-AR")}</div><div className="text-[0.7rem] text-muted-foreground">ARS</div></div>
      </div>
      <div className="flex gap-2 mt-3"><button type="button" className="btn-mini flex-1" onClick={() => viewReceipt(p)}>📎 Ver comprobante</button></div>
      {!readonly && <div className="flex gap-2 mt-2"><button type="button" className="btn-mini flex-1 !bg-success/15 !text-success" disabled={busyId === p.id} onClick={() => resolve(p.id, true)}>✓ Aprobar</button><button type="button" className="btn-mini flex-1 !bg-warning/15 !text-warning" disabled={busyId === p.id} onClick={() => resolve(p.id, false)}>✗ Rechazar</button></div>}
    </div>
  );
}

function Usuarios() {
  const promoteUser = useServerFn(promoteUserToAdminFn);
  const revoke = useServerFn(revokeAdminFn);
  const [users, setUsers] = useState<UsuarioRow[]>([]);
  const [credits, setCredits] = useState<Record<string, { retirables: number; bonus: number }>>({});
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [roleBusy, setRoleBusy] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const [{ data: profs, error: pErr }, { data: cr }, { data: rs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,nombre,apellido,dni,email,provincia,localidad,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("user_credits").select("user_id,retirables,bonus"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    if (pErr) toast.error(pErr.message);
    setUsers(((profs ?? []) as UsuarioRow[]));
    const cMap: Record<string, { retirables: number; bonus: number }> = {};
    for (const c of (cr ?? []) as { user_id: string; retirables: number; bonus: number }[]) {
      cMap[c.user_id] = { retirables: c.retirables, bonus: c.bonus };
    }
    setCredits(cMap);
    const rMap: Record<string, string[]> = {};
    for (const r of (rs ?? []) as { user_id: string; role: string }[]) {
      (rMap[r.user_id] ??= []).push(r.role);
    }
    setRoles(rMap);
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.nombre.toLowerCase().includes(q) ||
      u.apellido.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.dni ?? "").toLowerCase().includes(q)
    );
  });

  const displayName = (u: UsuarioRow) => `${u.nombre} ${u.apellido}`.trim() || u.email || "este usuario";

  const handleMakeAdmin = async (u: UsuarioRow) => {
    if (!confirm(`¿Confirmás que querés promover a ${displayName(u)} como Administrador?`)) return;
    setRoleBusy(u.user_id);
    try {
      await promoteUser({ data: { userId: u.user_id } });
      // Releer desde BD para confirmar que se persistió
      const { data: rs } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user_id);
      const fresh = ((rs ?? []) as { role: string }[]).map((r) => r.role);
      setRoles((prev) => ({ ...prev, [u.user_id]: fresh }));
      if (fresh.includes("admin")) toast.success(`${displayName(u)} ahora es ADMIN`);
      else toast.error("No se pudo confirmar el cambio en la base de datos");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setRoleBusy(null);
    }
  };

  const handleRemoveAdmin = async (u: UsuarioRow) => {
    if (!confirm(`¿Confirmás que querés quitar el rol Administrador a ${displayName(u)}?`)) return;
    setRoleBusy(u.user_id);
    try {
      await revoke({ data: { userId: u.user_id } });
      const { data: rs } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user_id);
      const fresh = ((rs ?? []) as { role: string }[]).map((r) => r.role);
      setRoles((prev) => ({ ...prev, [u.user_id]: fresh }));
      if (!fresh.includes("admin")) toast.success(`${displayName(u)} vuelve a usuario normal`);
      else toast.error("No se pudo confirmar el cambio en la base de datos");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setRoleBusy(null);
    }
  };

  return (
    <>
      <div className="section-label !mt-0">Usuarios registrados ({users.length})</div>
      <div className="card-base mb-3 grid grid-cols-[1fr_auto] gap-2">
        <input
          className="field-input"
          placeholder="Buscar por nombre, email o DNI"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="btn-mini" onClick={() => void reload()}>↻</button>
      </div>
      {loading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {!loading && filtered.length === 0 && (
        <div className="text-sm text-muted-foreground">No hay usuarios{search ? " que coincidan con la búsqueda" : ""}.</div>
      )}
      {filtered.map((u) => {
        const c = credits[u.user_id] ?? { retirables: 0, bonus: 0 };
        const userRoles = roles[u.user_id] ?? [];
        const isAdmin = userRoles.includes("admin");
        const isSuper = userRoles.includes("superadmin");
        return (
          <div key={u.user_id} className="card-base flex items-center justify-between mb-2 !py-3 gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                {u.nombre} {u.apellido}
                {isSuper && <span className="tag tag-danger">super</span>}
                {isAdmin && !isSuper && <span className="tag tag-gold">admin</span>}
              </div>
              <div className="text-[0.7rem] text-muted-foreground mt-0.5 truncate">
                {u.email ?? "—"} · DNI {u.dni ?? "—"}
              </div>
              <div className="text-[0.65rem] text-muted-foreground mt-0.5">
                Alta: {new Date(u.created_at).toLocaleDateString("es-AR")}
              </div>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <div>
                <div className="font-display text-xs font-extrabold text-success">{c.retirables} cr</div>
                <div className="font-display text-[0.65rem] font-bold text-warning mt-0.5">{c.bonus} bonus</div>
              </div>
              {!isSuper && (
                <button
                  type="button"
                  className={`btn-role-action ${isAdmin ? "is-danger" : "is-gold"}`}
                  disabled={roleBusy === u.user_id}
                  onClick={() => (isAdmin ? void handleRemoveAdmin(u) : void handleMakeAdmin(u))}
                >
                  {roleBusy === u.user_id ? "…" : isAdmin ? "Quitar Admin" : "Hacer Admin"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

interface FinPurchase {
  id: string;
  created_at: string;
  user_id: string;
  admin_id: string | null;
  package_id: string;
  package_name: string;
  credits: number;
  bonus: number;
  amount_ars: number;
  status: string;
}
interface FinPayout {
  id: string;
  created_at: string;
  matchday_id: string;
  user_id: string;
  ranking_prize: number;
  base_prize: number;
}
interface FinMatchday {
  id: string;
  number: number;
  closed_at: string | null;
  tournament_id: string;
}
interface FinTournament { id: string; name: string }

const ARS_PER_CREDIT = 50; // 5000 ARS = 100 cr ⇒ 50 ARS/cr (paquete Starter)

function fmtARS(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function Finanzas() {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<FinPurchase[]>([]);
  const [payouts, setPayouts] = useState<FinPayout[]>([]);
  const [matchdays, setMatchdays] = useState<FinMatchday[]>([]);
  const [tournaments, setTournaments] = useState<FinTournament[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { nombre: string; apellido: string; email: string | null }>>({});
  const [activeUsers, setActiveUsers] = useState(0);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [filterAdmin, setFilterAdmin] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [
        { data: pur },
        { data: pay },
        { data: md },
        { data: tr },
        { data: cr },
      ] = await Promise.all([
        supabase
          .from("credit_purchase_requests" as never)
          .select("id, created_at, user_id, admin_id, package_id, package_name, credits, bonus, amount_ars, status")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("matchday_payouts" as never)
          .select("id, created_at, matchday_id, user_id, ranking_prize, base_prize")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("matchdays").select("id, number, closed_at, tournament_id"),
        supabase.from("tournaments").select("id, name"),
        supabase.from("user_credits").select("user_id, retirables, bonus"),
      ]);

      const purchasesRows = (pur ?? []) as unknown as FinPurchase[];
      const payoutsRows = (pay ?? []) as unknown as FinPayout[];
      setPurchases(purchasesRows);
      setPayouts(payoutsRows);
      setMatchdays((md ?? []) as FinMatchday[]);
      setTournaments((tr ?? []) as FinTournament[]);
      setActiveUsers(((cr ?? []) as { retirables: number; bonus: number }[]).filter((u) => u.retirables > 0 || u.bonus > 0).length);

      const ids = Array.from(new Set([
        ...purchasesRows.map((p) => p.user_id),
        ...purchasesRows.map((p) => p.admin_id).filter((x): x is string => !!x),
      ]));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id,nombre,apellido,email").in("user_id", ids);
        const m: Record<string, { nombre: string; apellido: string; email: string | null }> = {};
        for (const p of (profs ?? []) as { user_id: string; nombre: string; apellido: string; email: string | null }[]) {
          m[p.user_id] = { nombre: p.nombre, apellido: p.apellido, email: p.email };
        }
        setProfilesMap(m);
      } else setProfilesMap({});
      setLoading(false);
    })();
  }, []);

  const approved = purchases.filter((p) => p.status === "approved");
  const totalRecaudado = approved.reduce((s, p) => s + p.amount_ars, 0);
  const cantidadVendidos = approved.length;

  const packagesAgg: Record<string, { name: string; count: number; ars: number; credits: number }> = {};
  for (const p of approved) {
    const key = p.package_id || p.package_name;
    if (!packagesAgg[key]) packagesAgg[key] = { name: p.package_name, count: 0, ars: 0, credits: p.credits };
    packagesAgg[key].count += 1;
    packagesAgg[key].ars += p.amount_ars;
  }
  const ranking = Object.entries(packagesAgg)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count);
  const topPackage = ranking[0];

  const superARS = totalRecaudado * 0.30;
  const adminARS = totalRecaudado * 0.10;
  const fondoARS = totalRecaudado * 0.60;
  const baseARS = totalRecaudado * 0.10;
  const pozosARS = totalRecaudado * 0.50;

  // Filtros tabla compras
  const adminOptions = Array.from(new Set(purchases.map((p) => p.admin_id).filter((x): x is string => !!x)));
  const filteredPurchases = purchases.filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterAdmin !== "all" && p.admin_id !== filterAdmin) return false;
    if (filterFrom && new Date(p.created_at) < new Date(filterFrom)) return false;
    if (filterTo && new Date(p.created_at) > new Date(filterTo + "T23:59:59")) return false;
    return true;
  });

  const mdMap = new Map(matchdays.map((m) => [m.id, m]));
  const trMap = new Map(tournaments.map((t) => [t.id, t.name]));

  const payoutsByMatchday: Record<string, { matchday: FinMatchday; users: Set<string>; total: number }> = {};
  for (const py of payouts) {
    const md = mdMap.get(py.matchday_id);
    if (!md) continue;
    if (!payoutsByMatchday[py.matchday_id]) payoutsByMatchday[py.matchday_id] = { matchday: md, users: new Set(), total: 0 };
    payoutsByMatchday[py.matchday_id].users.add(py.user_id);
    payoutsByMatchday[py.matchday_id].total += (py.ranking_prize ?? 0) + (py.base_prize ?? 0);
  }
  const premiosRows = Object.values(payoutsByMatchday).sort((a, b) => {
    const ad = a.matchday.closed_at ?? "";
    const bd = b.matchday.closed_at ?? "";
    return bd.localeCompare(ad);
  });

  const profileLabel = (uid: string | null) => {
    if (!uid) return "—";
    const p = profilesMap[uid];
    if (!p) return "—";
    const n = `${p.nombre} ${p.apellido}`.trim();
    return n || (p.email ?? "Jugador");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Cargando finanzas…</div>;

  return (
    <>
      {/* RESUMEN GENERAL */}
      <div className="section-label !mt-0">Resumen general</div>
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="card-base text-center !p-3">
          <div className="font-display text-xl font-extrabold text-primary">{cantidadVendidos > 0 ? fmtARS(totalRecaudado) : "0"}</div>
          <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-1">Total recaudado</div>
        </div>
        <div className="card-base text-center !p-3">
          <div className="font-display text-xl font-extrabold text-primary">{cantidadVendidos}</div>
          <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-1">Paquetes vendidos</div>
        </div>
        <div className="card-base text-center !p-3">
          <div className="font-display text-base font-extrabold text-foreground truncate">{topPackage ? topPackage.name : "Sin datos aún"}</div>
          <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-1">Paquete más vendido</div>
        </div>
        <div className="card-base text-center !p-3">
          <div className="font-display text-xl font-extrabold text-success">{activeUsers}</div>
          <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-1">Usuarios c/ créditos</div>
        </div>
      </div>

      {/* DISTRIBUCIÓN */}
      <div className="section-label">Distribución de ingresos</div>
      <div className="card-base mb-4">
        {totalRecaudado === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-2">Sin datos aún</div>
        ) : (
          <>
            <DistRow label="30% Superadmin" value={fmtARS(superARS)} color="var(--primary)" />
            <DistRow label="10% Admins afiliadores" value={fmtARS(adminARS)} color="var(--warning)" />
            <DistRow label="60% Fondo de premios" value={fmtARS(fondoARS)} color="var(--success)" bold />
            <div className="pl-3 mt-1 border-l-2 border-success/30">
              <DistRow label="↳ 10% premios base (acierto inmediato)" value={fmtARS(baseARS)} color="var(--muted-foreground)" small />
              <DistRow label="↳ 50% pozos por fecha" value={fmtARS(pozosARS)} color="var(--muted-foreground)" small last />
            </div>
          </>
        )}
      </div>

      {/* TABLA DE COMPRAS */}
      <div className="section-label">Compras ({filteredPurchases.length})</div>
      <div className="card-base mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select className="field-input !py-1.5" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}>
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="approved">Aprobada</option>
          <option value="rejected">Rechazada</option>
        </select>
        <select className="field-input !py-1.5" value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value)}>
          <option value="all">Todos los admins</option>
          {adminOptions.map((id) => (
            <option key={id} value={id}>{profileLabel(id)}</option>
          ))}
        </select>
        <input className="field-input !py-1.5" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        <input className="field-input !py-1.5" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
      </div>
      {filteredPurchases.length === 0 ? (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground">Sin datos aún</div>
      ) : (
        <div className="card-base !p-0 overflow-x-auto mb-5">
          <table className="w-full text-[0.72rem]">
            <thead className="text-muted-foreground uppercase text-[0.6rem] tracking-wider">
              <tr className="border-b border-border/40">
                <th className="text-left p-2">Fecha</th>
                <th className="text-left p-2">Usuario</th>
                <th className="text-left p-2">Admin</th>
                <th className="text-left p-2">Paquete</th>
                <th className="text-right p-2">Monto</th>
                <th className="text-center p-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((p) => (
                <tr key={p.id} className="border-b border-border/20">
                  <td className="p-2 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString("es-AR")}</td>
                  <td className="p-2 truncate max-w-[120px]">{profileLabel(p.user_id)}</td>
                  <td className="p-2 truncate max-w-[120px]">{p.admin_id ? profileLabel(p.admin_id) : "—"}</td>
                  <td className="p-2">{p.package_name}</td>
                  <td className="p-2 text-right font-bold text-primary whitespace-nowrap">{fmtARS(p.amount_ars)}</td>
                  <td className="p-2 text-center">
                    <span className={`tag ${p.status === "approved" ? "tag-success" : p.status === "rejected" ? "tag-warning" : "tag-gold"}`}>
                      {p.status === "approved" ? "✓" : p.status === "rejected" ? "✗" : "…"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TABLA DE PREMIOS PAGADOS */}
      <div className="section-label">Premios pagados</div>
      {premiosRows.length === 0 ? (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground mb-5">Sin datos aún</div>
      ) : (
        <div className="card-base !p-0 overflow-x-auto mb-5">
          <table className="w-full text-[0.72rem]">
            <thead className="text-muted-foreground uppercase text-[0.6rem] tracking-wider">
              <tr className="border-b border-border/40">
                <th className="text-left p-2">Cerrada</th>
                <th className="text-left p-2">Liga</th>
                <th className="text-center p-2">Fecha N°</th>
                <th className="text-right p-2">Premiados</th>
                <th className="text-right p-2">Cr. distribuidos</th>
                <th className="text-right p-2">Equivalente ARS</th>
              </tr>
            </thead>
            <tbody>
              {premiosRows.map((row) => (
                <tr key={row.matchday.id} className="border-b border-border/20">
                  <td className="p-2 whitespace-nowrap">{row.matchday.closed_at ? new Date(row.matchday.closed_at).toLocaleDateString("es-AR") : "—"}</td>
                  <td className="p-2 truncate max-w-[120px]">{trMap.get(row.matchday.tournament_id) ?? "—"}</td>
                  <td className="p-2 text-center">{row.matchday.number}</td>
                  <td className="p-2 text-right">{row.users.size}</td>
                  <td className="p-2 text-right font-bold text-success">{row.total}</td>
                  <td className="p-2 text-right text-muted-foreground">{fmtARS(row.total * ARS_PER_CREDIT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PAQUETES MÁS VENDIDOS */}
      <div className="section-label">Paquetes más vendidos</div>
      {ranking.length === 0 ? (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground">Sin datos aún</div>
      ) : (
        <div className="card-base !p-0 overflow-hidden">
          {ranking.map((r, i) => {
            const max = ranking[0].count;
            const pct = Math.round((r.count / max) * 100);
            return (
              <div key={r.id} className="px-3 py-2.5 border-b border-border/20 last:border-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-display text-base font-extrabold text-primary">{i + 1}°</span>
                    <span className="text-sm font-bold text-foreground truncate">{r.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[0.7rem] text-muted-foreground">{r.count} {r.count === 1 ? "vez" : "veces"}</div>
                    <div className="font-display text-sm font-extrabold text-primary">{fmtARS(r.ars)}</div>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function DistRow({ label, value, color, bold, small, last }: { label: string; value: string; color: string; bold?: boolean; small?: boolean; last?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2 ${last ? "" : "border-b border-border/30"}`}>
      <span className={`${small ? "text-[0.7rem]" : "text-sm"} text-muted-foreground`}>{label}</span>
      <span className={`font-display ${bold ? "text-base font-extrabold" : small ? "text-xs font-bold" : "text-sm font-bold"}`} style={{ color }}>{value}</span>
    </div>
  );
}
