import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "user" | "admin" | "superadmin";

export interface ProfileRow {
  user_id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  provincia: string | null;
  localidad: string | null;
  ref_code: string | null;
}

export interface CreditsRow {
  retirables: number;
  bonus: number;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  credits: CreditsRow | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [credits, setCredits] = useState<CreditsRow | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: cr }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("user_id,nombre,apellido,dni,telefono,email,provincia,localidad,ref_code").eq("user_id", uid).maybeSingle(),
      supabase.from("user_credits").select("retirables,bonus").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as ProfileRow | null) ?? null);
    setCredits((cr as CreditsRow | null) ?? { retirables: 0, bonus: 0 });
    setRoles(((rs as { role: AppRole }[] | null) ?? []).map((r) => r.role));
  };

  const refresh = async () => {
    if (!user) return;
    await loadUserData(user.id);
  };

  useEffect(() => {
    // 1) Suscribirse PRIMERO
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // diferir consulta para evitar deadlock
        setTimeout(() => {
          void loadUserData(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setCredits(null);
        setRoles([]);
      }
    });

    // 2) Después leer sesión actual
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadUserData(data.session.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthContextValue = {
    session,
    user,
    profile,
    credits,
    roles,
    loading,
    hasRole: (r) => roles.includes(r),
    signOut,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
