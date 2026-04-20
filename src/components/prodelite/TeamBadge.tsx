interface TeamBadgeProps {
  initials: string;
  color: string;
}

export function TeamBadge({ initials, color }: TeamBadgeProps) {
  return (
    <div
      className="team-badge"
      style={{
        background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
