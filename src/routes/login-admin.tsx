import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginCard } from "./login";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login-admin")({
  head: () => ({
    meta: [
      { title: "Acceso Admin — PRODELITE" },
      { name: "description", content: "Acceso al panel de administración de PRODELITE." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/admin" });
  },
  component: LoginAdmin,
});

function LoginAdmin() {
  return <LoginCard isAdmin />;
}
