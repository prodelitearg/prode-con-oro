import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/prodelite/Logo";
import { supabase } from "@/integrations/supabase/client";
import { PROVINCIAS } from "@/lib/provincias";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Crear cuenta — PRODELITE" },
      { name: "description", content: "Registrate en PRODELITE y empezá a pronosticar partidos." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { ref?: string } => {
    const ref = typeof search.ref === "string" && search.ref.length > 0 ? search.ref : undefined;
    return ref ? { ref } : {};
  },
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app/partidos" });
  },
  component: Register,
});

interface FormState {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  provincia: string;
  localidad: string;
  pass: string;
  ref: string;
}

function Register() {
  const navigate = useNavigate();
  const { ref: refFromUrl } = Route.useSearch() as { ref?: string };
  const [f, setF] = useState<FormState>({
    nombre: "",
    apellido: "",
    dni: "",
    email: "",
    telefono: "",
    provincia: "",
    localidad: "",
    pass: "",
    ref: refFromUrl ?? "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (refFromUrl) setF((p) => ({ ...p, ref: refFromUrl }));
  }, [refFromUrl]);

  const u = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.pass.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setLoading(true);
    const redirectUrl = `${window.location.origin}/app/partidos`;
    const { error } = await supabase.auth.signUp({
      email: f.email,
      password: f.pass,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nombre: f.nombre,
          apellido: f.apellido,
          dni: f.dni,
          telefono: f.telefono,
          provincia: f.provincia,
          localidad: f.localidad,
          ref: f.ref,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("¡Cuenta creada! Bienvenido a PRODELITE");
    navigate({ to: "/app/partidos" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-8">
      <div className="card-elevated w-full max-w-md">
        <div className="text-center mb-5">
          <Logo size="md" />
          <h1 className="font-display text-2xl font-extrabold tracking-[0.15em] uppercase mt-2">
            Crear cuenta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Completá tus datos para empezar a jugar</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="field-label" htmlFor="nombre">Nombre</label>
              <input id="nombre" required className="field-input" value={f.nombre} onChange={u("nombre")} />
            </div>
            <div>
              <label className="field-label" htmlFor="apellido">Apellido</label>
              <input id="apellido" required className="field-input" value={f.apellido} onChange={u("apellido")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="field-label" htmlFor="dni">DNI</label>
              <input id="dni" inputMode="numeric" className="field-input" value={f.dni} onChange={u("dni")} />
            </div>
            <div>
              <label className="field-label" htmlFor="tel">Teléfono</label>
              <input id="tel" inputMode="tel" className="field-input" value={f.telefono} onChange={u("telefono")} />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="email-r">Correo electrónico</label>
            <input
              id="email-r"
              type="email"
              required
              autoComplete="email"
              className="field-input"
              placeholder="vos@email.com"
              value={f.email}
              onChange={u("email")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="field-label" htmlFor="prov">Provincia</label>
              <select id="prov" className="field-input" value={f.provincia} onChange={u("provincia")}>
                <option value="">Seleccioná</option>
                {PROVINCIAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="loc">Localidad</label>
              <input id="loc" className="field-input" value={f.localidad} onChange={u("localidad")} />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="pass-r">Contraseña</label>
            <input
              id="pass-r"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="field-input"
              placeholder="Mínimo 8 caracteres"
              value={f.pass}
              onChange={u("pass")}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="ref">Código de referido (opcional)</label>
            <input id="ref" className="field-input" value={f.ref} onChange={u("ref")} />
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Al registrarte aceptás los Términos y Condiciones de PRODELITE.
          </p>

          <button type="submit" className="btn-gold mt-2" disabled={loading}>
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="text-primary font-bold hover:opacity-80">
            Ingresar
          </Link>
        </div>
      </div>
    </div>
  );
}
