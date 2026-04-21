import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/creditos")({
  head: () => ({
    meta: [
      { title: "Mis créditos — PRODELITE" },
      { name: "description", content: "Comprá paquetes de créditos y solicitá retiros." },
    ],
  }),
  component: CreditosPage,
});

const PAQUETES = [
  { id: "s", name: "Starter", creds: 100, bonus: 0, price: "$5.000" },
  { id: "p", name: "Plus", creds: 300, bonus: 30, price: "$13.500" },
  { id: "pr", name: "Pro", creds: 500, bonus: 80, price: "$21.000" },
  { id: "f", name: "Full", creds: 1000, bonus: 200, price: "$40.000" },
] as const;

function CreditosPage() {
  const { credits, user, refresh } = useAuth();
  const retirables = credits?.retirables ?? 0;
  const bonus = credits?.bonus ?? 0;
  const total = retirables + bonus;

  const [pkg, setPkg] = useState<string | null>(null);
  const [retiro, setRetiro] = useState("");
  const [alias, setAlias] = useState("");
  const [submitting, setSubmitting] = useState(false);

  type WithdrawalRow = {
    id: string;
    amount: number;
    alias: string;
    status: string;
    notes: string | null;
    created_at: string;
    processed_at: string | null;
  };
  const [history, setHistory] = useState<WithdrawalRow[]>([]);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("withdrawals" as never)
      .select("id, amount, alias, status, notes, created_at, processed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data ?? []) as unknown as WithdrawalRow[]);
  };

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const selected = PAQUETES.find((p) => p.id === pkg);

  const handleRetiro = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(retiro);
    if (!amount || amount < 500) {
      toast.error("El mínimo es 500 cr ($25.000 ARS)");
      return;
    }
    if (amount > retirables) {
      toast.error(`Solo podés retirar hasta ${retirables} cr`);
      return;
    }
    if (!alias.trim()) {
      toast.error("Ingresá tu alias o CVU");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("request_withdrawal" as never, {
      _amount: amount,
      _alias: alias.trim(),
    } as never);
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "No se pudo crear la solicitud");
      return;
    }
    toast.success("Solicitud enviada — tu administrador procesará el pago en 24-48hs");
    setRetiro("");
    setAlias("");
    await refresh();
    await loadHistory();
  };

  const handleCompra = () => {
    toast.info("Próximamente: integración con Mercado Pago");
  };

  return (
    <div className="app-wrap">
      <h1 className="section-label !mt-2">Mi saldo</h1>

      <div className="saldo-card">
        <div
          className="px-4 py-5 border-b border-border/40"
          style={{ background: "linear-gradient(135deg, var(--card), var(--navy-deep))" }}
        >
          <div className="text-[0.65rem] font-bold tracking-[0.2em] text-muted-foreground uppercase">
            Total disponible para jugar
          </div>
          <div className="font-display text-5xl font-extrabold text-primary leading-none mt-1">
            {total.toLocaleString("es-AR")}
          </div>
          <div className="text-sm text-muted-foreground mt-1 font-body">créditos totales</div>
        </div>

        {/* Retirables */}
        <div className="saldo-row">
          <div>
            <div className="text-sm font-bold text-foreground">Créditos retirables</div>
            <div className="text-xs text-muted-foreground mt-0.5">Compras · Premios · Aciertos · Referidos</div>
            <span className="tag tag-success mt-1.5">✓ Se pueden retirar</span>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-extrabold text-success">
              {retirables.toLocaleString("es-AR")} cr
            </div>
            <div className="text-[0.7rem] text-success/70 mt-0.5">
              ${(retirables * 50).toLocaleString("es-AR")} ARS
            </div>
          </div>
        </div>

        {/* Bonus */}
        <div className="saldo-row">
          <div>
            <div className="text-sm font-bold text-foreground">Créditos bonus</div>
            <div className="text-xs text-muted-foreground mt-0.5">Bonificación de paquetes comprados</div>
            <span className="tag tag-warning mt-1.5">⚽ Solo para jugar</span>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-extrabold text-warning">
              {bonus.toLocaleString("es-AR")} cr
            </div>
            <div className="text-[0.7rem] text-warning/70 mt-0.5">no retirables</div>
          </div>
        </div>
      </div>

      <h2 className="section-label">Comprar créditos</h2>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {PAQUETES.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setPkg(p.id)}
            className={`card-base text-center cursor-pointer transition-all ${
              pkg === p.id ? "border-primary shadow-[0_0_20px_oklch(0.80_0.155_88_/_0.15)] bg-card-2" : "hover:border-primary/40"
            }`}
          >
            <span className="tag tag-gold mb-2 inline-block">{p.name}</span>
            <div className="font-display text-3xl font-extrabold text-primary leading-none">{p.creds}</div>
            <div className="text-[0.65rem] text-muted-foreground mt-1 uppercase tracking-wide">
              créditos retirables
            </div>
            {p.bonus > 0 && (
              <div className="text-[0.7rem] text-success font-semibold mt-1">+{p.bonus} bonus</div>
            )}
            <div className={`text-base font-bold mt-1.5 ${pkg === p.id ? "text-foreground" : "text-muted-foreground"}`}>
              {p.price}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="card-base mb-5">
          <div className="rounded-lg border border-success/15 bg-success/[0.06] px-3.5 py-3 mb-3.5 text-sm text-muted-foreground leading-relaxed">
            Los <strong className="text-success">{selected.creds} cr principales</strong> son retirables.
            {selected.bonus > 0 && (
              <>
                {" "}
                Los <strong className="text-warning">{selected.bonus} cr bonus</strong> son solo para jugar.
              </>
            )}
          </div>
          <button type="button" className="btn-gold" onClick={handleCompra}>
            Pagar con Mercado Pago · {selected.price}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            También podés transferir y avisar a tu administrador.
          </p>
        </div>
      )}

      <h2 className="section-label">Solicitar retiro</h2>
      <form onSubmit={handleRetiro} className="card-base">
        <div className="rounded-lg border border-success/15 bg-success/[0.06] px-3.5 py-3 mb-3.5 text-sm text-muted-foreground leading-relaxed">
          Podés retirar hasta <strong className="text-success">{retirables.toLocaleString("es-AR")} cr</strong> ($
          {(retirables * 50).toLocaleString("es-AR")} ARS). Mínimo: 500 cr ($25.000 ARS).
          {bonus > 0 && (
            <>
              {" "}
              Los <strong className="text-warning">{bonus} cr bonus</strong> no se pueden retirar.
            </>
          )}
        </div>
        <div className="mb-3">
          <label className="field-label" htmlFor="ret-amount">
            Créditos a retirar (máx. {retirables})
          </label>
          <input
            id="ret-amount"
            type="number"
            inputMode="numeric"
            min={500}
            max={retirables || undefined}
            className="field-input"
            placeholder="500"
            value={retiro}
            onChange={(e) => setRetiro(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="field-label" htmlFor="ret-alias">
            Alias o CVU de Mercado Pago
          </label>
          <input
            id="ret-alias"
            className="field-input"
            placeholder="alias.mp"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-gold" disabled={retirables < 500 || submitting}>
          {submitting ? "Enviando…" : "Solicitar retiro"}
        </button>
        {retirables < 500 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Necesitás al menos 500 cr retirables para pedir un retiro.
          </p>
        )}
      </form>

      {history.length > 0 && (
        <>
          <h2 className="section-label">Mis solicitudes</h2>
          <div className="space-y-2 mb-4">
            {history.map((w) => {
              const tag =
                w.status === "approved"
                  ? "tag-success"
                  : w.status === "rejected"
                    ? "tag-warning"
                    : "tag-gold";
              const label =
                w.status === "approved" ? "✓ Pagada" : w.status === "rejected" ? "✗ Rechazada" : "⏳ Pendiente";
              return (
                <div key={w.id} className="card-base !py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground">{w.amount.toLocaleString("es-AR")} cr</div>
                    <div className="text-[0.7rem] text-muted-foreground mt-0.5 truncate">
                      {new Date(w.created_at).toLocaleDateString("es-AR")} · {w.alias}
                    </div>
                    {w.notes && (
                      <div className="text-[0.7rem] text-muted-foreground italic mt-1 truncate">“{w.notes}”</div>
                    )}
                  </div>
                  <span className={`tag ${tag} shrink-0`}>{label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
