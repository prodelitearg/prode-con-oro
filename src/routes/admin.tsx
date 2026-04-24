import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

const TABS = ["dashboard", "afiliados", "compras", "retiros", "comisiones"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  dashboard: "Panel",
  afiliados: "Afiliados",
  compras: "Compras",
  retiros: "Retiros",
  comisiones: "Comisiones",
};

interface Affiliate {
  user_id: string;
  nombre: string;
  apellido: string;
  localidad: string | null;
  provincia: string | null;
  created_at: string;
  retirables: number;
  bonus: number;
}

interface CommissionRow {
  id: string;
  amount: number;
  created_at: string;
  matchdays: {
    number: number;
    closed_at: string | null;
    tournaments: { name: string } | null;
  } | null;
}

interface AdminData {
  affiliates: Affiliate[];
  commissions: CommissionRow[];
  loading: boolean;
}

function useAdminData(userId: string | undefined): AdminData {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      const [profRes, comRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, nombre, apellido, localidad, provincia, created_at")
          .eq("admin_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("matchday_commissions")
          .select("id, amount, created_at, matchdays(number, closed_at, tournaments(name))")
          .eq("recipient_user_id", userId)
          .eq("kind", "admin")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (profRes.error) console.error(profRes.error);
      if (comRes.error) console.error(comRes.error);

      const profs = profRes.data ?? [];
      let credits: Record<string, { retirables: number; bonus: number }> = {};
      if (profs.length > 0) {
        const ids = profs.map((p) => p.user_id);
        const { data: cr } = await supabase
          .from("user_credits")
          .select("user_id, retirables, bonus")
          .in("user_id", ids);
        credits = Object.fromEntries(
          (cr ?? []).map((c) => [c.user_id, { retirables: c.retirables, bonus: c.bonus }]),
        );
      }

      setAffiliates(
        profs.map((p) => ({
          ...p,
          retirables: credits[p.user_id]?.retirables ?? 0,
          bonus: credits[p.user_id]?.bonus ?? 0,
        })),
      );
      setCommissions((comRes.data ?? []) as unknown as CommissionRow[]);
      setLoading(false);
    };
    void load();
  }, [userId]);

  return { affiliates, commissions, loading };
}

function AdminPanel() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [pendingPurchases, setPendingPurchases] = useState(0);
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();
  const data = useAdminData(user?.id);

  const loadPendingPurchases = useCallback(async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from("credit_purchase_requests" as never)
      .select("id", { count: "exact", head: true })
      .eq("admin_id", user.id)
      .eq("status", "pending");
    setPendingPurchases(count ?? 0);
  }, [user?.id]);

  useEffect(() => {
    void loadPendingPurchases();
  }, [loadPendingPurchases]);

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
          <span className="tag tag-gold">Admin</span>
        </div>
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

        {tab === "dashboard" && <DashTab data={data} refCode={profile?.ref_code ?? null} />}
        {tab === "afiliados" && <AfiliadosTab data={data} />}
        {tab === "compras" && <ComprasTab adminId={user?.id} onChanged={loadPendingPurchases} />}
        {tab === "retiros" && <RetirosTab adminId={user?.id} />}
        {tab === "comisiones" && <ComisionesTab data={data} />}
      </div>
    </>
  );
}

function DashTab({ data, refCode }: { data: AdminData; refCode: string | null }) {
  const totalCom = data.commissions.reduce((s, c) => s + c.amount, 0);
  const fechasCobradas = useMemo(
    () => new Set(data.commissions.map((c) => c.matchdays?.number).filter(Boolean)).size,
    [data.commissions],
  );

  const copyRef = async () => {
    if (!refCode) return;
    const url = `${window.location.origin}/ref/${refCode}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const stats = [
    { v: String(data.affiliates.length), l: "Afiliados" },
    { v: String(fechasCobradas), l: "Fechas cobradas" },
    { v: `${totalCom}`, l: "Cr. ganados" },
    { v: "10%", l: "Comisión" },
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

      <button
        type="button"
        onClick={copyRef}
        className="card-base w-full text-left hover:border-primary/40 transition-colors"
      >
        <div className="text-xs text-muted-foreground">Tu link de afiliación</div>
        <div className="font-display text-sm font-bold text-primary mt-1 truncate">
          {typeof window !== "undefined" ? window.location.host : "prodelite.com"}/ref/{refCode ?? "—"}
        </div>
        <div className="text-[0.65rem] text-muted-foreground mt-1">Tocá para copiar</div>
      </button>

      <div className="section-label">Últimas comisiones</div>
      {data.loading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {!data.loading && data.commissions.length === 0 && (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground">
          Todavía no hay comisiones. Cuando se cierre una fecha donde tus afiliados participen, vas a verlas acá.
        </div>
      )}
      {data.commissions.slice(0, 5).map((c) => (
        <div key={c.id} className="card-base flex items-center justify-between mb-2 !py-3">
          <div className="min-w-0">
            <div className="text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase font-semibold truncate">
              {c.matchdays?.tournaments?.name ?? "—"}
            </div>
            <div className="text-sm font-bold text-foreground mt-0.5">Fecha {c.matchdays?.number ?? "?"}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-base font-extrabold text-success">+{c.amount} cr</div>
            <span className="tag tag-success mt-1 inline-block">✓ retirable</span>
          </div>
        </div>
      ))}
    </>
  );
}

function AfiliadosTab({ data }: { data: AdminData }) {
  return (
    <>
      <div className="section-label !mt-0">Mis afiliados ({data.affiliates.length})</div>
      {data.loading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {!data.loading && data.affiliates.length === 0 && (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground">
          Todavía no tenés afiliados. Compartí tu link desde el panel.
        </div>
      )}
      {data.affiliates.map((a) => (
        <div key={a.user_id} className="card-base flex items-center justify-between mb-2 !py-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground truncate">
              {a.nombre} {a.apellido}
            </div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5 truncate">
              {a.localidad || "—"}{a.provincia ? `, ${a.provincia}` : ""}
            </div>
            <div className="text-[0.65rem] text-muted-foreground mt-0.5">
              Desde {new Date(a.created_at).toLocaleDateString("es-AR")}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-sm font-extrabold text-success">{a.retirables} cr ret.</div>
            {a.bonus > 0 && <div className="text-[0.7rem] font-bold text-warning mt-0.5">{a.bonus} cr bonus</div>}
          </div>
        </div>
      ))}
    </>
  );
}

interface WithdrawalReq {
  id: string;
  user_id: string;
  amount: number;
  alias: string;
  status: string;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
  profile_name?: string;
}

function RetirosTab({ adminId }: { adminId: string | undefined }) {
  const [items, setItems] = useState<WithdrawalReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("withdrawals" as never)
      .select("id, user_id, amount, alias, status, notes, created_at, processed_at")
      .eq("admin_id", adminId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      setItems([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as WithdrawalReq[];
    if (rows.length > 0) {
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nombre, apellido")
        .in("user_id", ids);
      const map = new Map((profs ?? []).map((p) => [p.user_id, `${p.nombre} ${p.apellido}`.trim()]));
      setItems(rows.map((r) => ({ ...r, profile_name: map.get(r.user_id) ?? "Jugador" })));
    } else {
      setItems([]);
    }
    setLoading(false);
  }, [adminId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (id: string, approve: boolean) => {
    let notes: string | null = null;
    if (!approve) {
      const txt = window.prompt("Motivo del rechazo (opcional):") ?? "";
      notes = txt.trim() || null;
    } else if (!window.confirm("¿Confirmás que pagaste por Mercado Pago y querés marcar como aprobada?")) {
      return;
    }
    setBusyId(id);
    const { error } = await supabase.rpc("resolve_withdrawal" as never, {
      _withdrawal_id: id,
      _approve: approve,
      _notes: notes,
    } as never);
    setBusyId(null);
    if (error) {
      toast.error(error.message ?? "No se pudo procesar");
      return;
    }
    toast.success(approve ? "Solicitud aprobada" : "Solicitud rechazada y créditos devueltos");
    await load();
  };

  const pending = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending");

  return (
    <>
      <div className="section-label !mt-0">Pendientes ({pending.length})</div>
      {loading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {!loading && pending.length === 0 && (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground">
          No hay solicitudes pendientes.
        </div>
      )}
      {pending.map((w) => (
        <div key={w.id} className="card-base mb-2 !py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate">{w.profile_name}</div>
              <div className="text-[0.7rem] text-muted-foreground mt-0.5">
                {new Date(w.created_at).toLocaleDateString("es-AR")} ·{" "}
                {new Date(w.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Alias: <strong className="text-foreground">{w.alias}</strong>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-lg font-extrabold text-primary">{w.amount} cr</div>
              <div className="text-[0.7rem] text-muted-foreground">
                ${(w.amount * 50).toLocaleString("es-AR")} ARS
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              className="btn-mini flex-1 !bg-success/15 !text-success"
              disabled={busyId === w.id}
              onClick={() => resolve(w.id, true)}
            >
              ✓ Aprobar
            </button>
            <button
              type="button"
              className="btn-mini flex-1 !bg-warning/15 !text-warning"
              disabled={busyId === w.id}
              onClick={() => resolve(w.id, false)}
            >
              ✗ Rechazar
            </button>
          </div>
        </div>
      ))}

      <div className="section-label">Historial</div>
      {!loading && resolved.length === 0 && (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground">
          Sin solicitudes resueltas.
        </div>
      )}
      {resolved.map((w) => {
        const tag = w.status === "approved" ? "tag-success" : "tag-warning";
        const label = w.status === "approved" ? "✓ Pagada" : "✗ Rechazada";
        return (
          <div key={w.id} className="card-base flex items-center justify-between mb-2 !py-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate">{w.profile_name}</div>
              <div className="text-[0.7rem] text-muted-foreground mt-0.5">
                {w.processed_at
                  ? new Date(w.processed_at).toLocaleDateString("es-AR")
                  : new Date(w.created_at).toLocaleDateString("es-AR")}{" "}
                · {w.alias}
              </div>
              {w.notes && (
                <div className="text-[0.7rem] text-muted-foreground italic mt-0.5 truncate">“{w.notes}”</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-base font-extrabold text-foreground">{w.amount} cr</div>
              <span className={`tag ${tag} mt-1 inline-block`}>{label}</span>
            </div>
          </div>
        );
      })}
    </>
  );
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

function ComprasTab({ adminId }: { adminId: string | undefined }) {
  const [items, setItems] = useState<PurchaseReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("credit_purchase_requests" as never)
      .select("id, user_id, package_name, credits, bonus, amount_ars, receipt_url, status, notes, created_at, processed_at")
      .eq("admin_id", adminId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      setItems([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as PurchaseReq[];
    if (rows.length > 0) {
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nombre, apellido")
        .in("user_id", ids);
      const map = new Map((profs ?? []).map((p) => [p.user_id, `${p.nombre} ${p.apellido}`.trim()]));
      setItems(rows.map((r) => ({ ...r, profile_name: map.get(r.user_id) ?? "Jugador" })));
    } else {
      setItems([]);
    }
    setLoading(false);
  }, [adminId]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewReceipt = async (req: PurchaseReq) => {
    if (signedUrls[req.id]) {
      window.open(signedUrls[req.id], "_blank", "noopener");
      return;
    }
    const { data, error } = await supabase.storage
      .from("credit-receipts")
      .createSignedUrl(req.receipt_url, 300);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "No se pudo abrir el comprobante");
      return;
    }
    setSignedUrls((s) => ({ ...s, [req.id]: data.signedUrl }));
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const resolve = async (id: string, approve: boolean) => {
    let notes: string | null = null;
    if (!approve) {
      const txt = window.prompt("Motivo del rechazo (opcional):") ?? "";
      notes = txt.trim() || null;
    } else if (!window.confirm("¿Confirmás que recibiste el pago y querés acreditar los créditos?")) {
      return;
    }
    setBusyId(id);
    const { error } = await supabase.rpc("resolve_credit_purchase" as never, {
      _request_id: id,
      _approve: approve,
      _notes: notes,
    } as never);
    setBusyId(null);
    if (error) {
      toast.error(error.message ?? "No se pudo procesar");
      return;
    }
    toast.success(approve ? "Compra acreditada" : "Compra rechazada");
    await load();
  };

  const pending = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending");

  return (
    <>
      <div className="section-label !mt-0">Pendientes ({pending.length})</div>
      {loading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {!loading && pending.length === 0 && (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground">
          No hay compras pendientes.
        </div>
      )}
      {pending.map((p) => (
        <div key={p.id} className="card-base mb-2 !py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate">{p.profile_name}</div>
              <div className="text-[0.7rem] text-muted-foreground mt-0.5">
                {new Date(p.created_at).toLocaleDateString("es-AR")} ·{" "}
                {new Date(p.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <strong className="text-foreground">{p.package_name}</strong> · {p.credits} cr ret.
                {p.bonus > 0 && <> + <span className="text-warning">{p.bonus} bonus</span></>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-lg font-extrabold text-primary">
                ${p.amount_ars.toLocaleString("es-AR")}
              </div>
              <div className="text-[0.7rem] text-muted-foreground">ARS</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              className="btn-mini flex-1"
              onClick={() => viewReceipt(p)}
            >
              📎 Ver comprobante
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="btn-mini flex-1 !bg-success/15 !text-success"
              disabled={busyId === p.id}
              onClick={() => resolve(p.id, true)}
            >
              ✓ Aprobar
            </button>
            <button
              type="button"
              className="btn-mini flex-1 !bg-warning/15 !text-warning"
              disabled={busyId === p.id}
              onClick={() => resolve(p.id, false)}
            >
              ✗ Rechazar
            </button>
          </div>
        </div>
      ))}

      <div className="section-label">Historial</div>
      {!loading && resolved.length === 0 && (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground">
          Sin compras resueltas.
        </div>
      )}
      {resolved.map((p) => {
        const tag = p.status === "approved" ? "tag-success" : "tag-warning";
        const label = p.status === "approved" ? "✓ Acreditada" : "✗ Rechazada";
        return (
          <div key={p.id} className="card-base mb-2 !py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground truncate">{p.profile_name}</div>
                <div className="text-[0.7rem] text-muted-foreground mt-0.5 truncate">
                  {p.processed_at
                    ? new Date(p.processed_at).toLocaleDateString("es-AR")
                    : new Date(p.created_at).toLocaleDateString("es-AR")}{" "}
                  · {p.package_name}
                </div>
                {p.notes && (
                  <div className="text-[0.7rem] text-muted-foreground italic mt-0.5 truncate">“{p.notes}”</div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-base font-extrabold text-foreground">
                  ${p.amount_ars.toLocaleString("es-AR")}
                </div>
                <span className={`tag ${tag} mt-1 inline-block`}>{label}</span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function ComisionesTab({ data }: { data: AdminData }) {
  const total = data.commissions.reduce((s, c) => s + c.amount, 0);

  return (
    <>
      <div className="section-label !mt-0">Mis comisiones (solo créditos retirables)</div>

      <div className="card-elevated text-center mb-3">
        <div className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">Total acumulado</div>
        <div className="font-display text-3xl font-extrabold text-primary mt-1">{total} cr</div>
        <div className="text-[0.7rem] text-muted-foreground mt-1">{data.commissions.length} fechas cobradas</div>
      </div>

      {data.loading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {!data.loading && data.commissions.length === 0 && (
        <div className="card-base text-center !py-5 text-sm text-muted-foreground">
          Sin comisiones todavía.
        </div>
      )}
      {data.commissions.map((c) => (
        <div key={c.id} className="card-base flex items-center justify-between mb-2 !py-3">
          <div className="min-w-0">
            <div className="text-[0.7rem] text-muted-foreground">
              {c.matchdays?.closed_at
                ? new Date(c.matchdays.closed_at).toLocaleDateString("es-AR")
                : new Date(c.created_at).toLocaleDateString("es-AR")}
            </div>
            <div className="text-sm font-bold text-foreground mt-0.5 truncate">
              {c.matchdays?.tournaments?.name ?? "—"} · F{c.matchdays?.number ?? "?"}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-base font-extrabold text-primary">+{c.amount} cr</div>
            <span className="tag tag-success mt-1 inline-block">✓ retirable</span>
          </div>
        </div>
      ))}
    </>
  );
}
