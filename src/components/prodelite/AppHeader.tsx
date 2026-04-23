import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { useAuth } from "@/contexts/AuthContext";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const { credits, profile, hasRole } = useAuth();
  const total = (credits?.retirables ?? 0) + (credits?.bonus ?? 0);
  const firstName = profile?.nombre?.split(" ")[0] ?? "Jugador";
  const isSuper = hasRole("superadmin");
  const isAdmin = hasRole("admin");

  return (
    <header className="app-header">
      {isSuper || isAdmin ? (
        <Link
          to={isSuper ? "/superadmin" : "/admin"}
          className="btn-mini no-underline"
          aria-label="Ir a mi panel"
        >
          🛠 Mi panel
        </Link>
      ) : (
        <div className="font-display text-[0.7rem] font-bold tracking-[0.2em] text-muted-foreground uppercase">
          {subtitle ?? "Liga"}
        </div>
      )}

      <div className="absolute left-1/2 -translate-x-1/2">
        <Logo size="sm" />
      </div>

      <Link to="/app/creditos" className="credits-pill no-underline">
        <div className="flex flex-col items-end leading-tight">
          <span className="font-display text-sm font-extrabold text-primary">
            {total.toLocaleString("es-AR")} cr
          </span>
          <span className="font-display text-[0.65rem] text-muted-foreground">{firstName}</span>
        </div>
      </Link>
    </header>
  );
}
