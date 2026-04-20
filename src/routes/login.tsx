import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/prodelite/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Ingresar — PRODELITE" },
      { name: "description", content: "Ingresá a tu cuenta de PRODELITE para jugar." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app/partidos" });
  },
  component: LoginPage,
});

function LoginPage() {
  return <LoginCard isAdmin={false} />;
}

export function LoginCard({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.user) {
      toast.error("No se pudo iniciar sesión");
      return;
    }
    // Determinar destino según rol
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const roleSet = new Set((roles ?? []).map((r) => r.role as string));
    if (roleSet.has("superadmin")) navigate({ to: "/superadmin" });
    else if (roleSet.has("admin")) navigate({ to: "/admin" });
    else navigate({ to: "/app/partidos" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-8">
      <div className="card-elevated w-full max-w-md">
        <div className="text-center mb-6">
          <Logo size="md" />
          <h1 className="font-display text-2xl font-extrabold tracking-[0.15em] uppercase mt-2">
            {isAdmin ? "Acceso Admin" : "Bienvenido"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Panel de administración" : "Ingresá a tu cuenta"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="field-label" htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="field-input"
              placeholder="vos@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="pass">Contraseña</label>
            <input
              id="pass"
              type="password"
              required
              autoComplete="current-password"
              className="field-input"
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            <div className="text-right mt-1.5">
              <button type="button" className="text-xs text-muted-foreground hover:text-primary">
                Olvidé mi contraseña
              </button>
            </div>
          </div>

          <button type="submit" className="btn-gold mt-2" disabled={loading}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        {!isAdmin && (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[0.65rem] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                o
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Link to="/register" className="btn-outline inline-block text-center">
              Crear cuenta nueva
            </Link>
          </>
        )}

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {isAdmin ? (
            <Link to="/" className="text-primary font-bold hover:opacity-80">
              ← Volver al inicio
            </Link>
          ) : (
            <Link to="/login-admin" className="text-primary font-bold hover:opacity-80">
              Ingresar como administrador
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
