import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { useAuth } from "@/contexts/AuthContext";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const { credits, profile } = useAuth();
  const total = (credits?.retirables ?? 0) + (credits?.bonus ?? 0);
  const firstName = profile?.nombre?.split(" ")[0] ?? "Jugador";

  return (
    <header className="app-header">
      <div className="font-display text-[0.7rem] font-bold tracking-[0.2em] text-muted-foreground uppercase">
        {subtitle ?? "Liga"}
      </div>

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
