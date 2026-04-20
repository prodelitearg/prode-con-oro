import { Link } from "@tanstack/react-router";

const items = [
  { to: "/app/partidos" as const, label: "Partidos", icon: "⚽" },
  { to: "/app/tabla" as const, label: "Tabla", icon: "🏆" },
  { to: "/app/creditos" as const, label: "Créditos", icon: "💰" },
  { to: "/app/perfil" as const, label: "Perfil", icon: "👤" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          className="bottom-nav-item"
          activeProps={{ "data-status": "active" } as never}
        >
          <span className="text-lg" aria-hidden>
            {it.icon}
          </span>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
