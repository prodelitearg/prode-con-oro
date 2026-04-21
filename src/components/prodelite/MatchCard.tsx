import { TeamBadge } from "./TeamBadge";

export interface MatchData {
  id: string;
  home_team: string;
  home_short: string;
  home_color: string;
  away_team: string;
  away_short: string;
  away_color: string;
  kickoff?: string;
}

interface MatchCardProps {
  match: MatchData;
  homeScore: string;
  awayScore: string;
  onChange: (matchId: string, side: "h" | "a", value: string) => void;
  highlight?: boolean;
  disabled?: boolean;
}

export function MatchCard({ match, homeScore, awayScore, onChange, highlight, disabled }: MatchCardProps) {
  const handle = (side: "h" | "a") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
    onChange(match.id, side, v);
  };

  const time = match.kickoff
    ? new Date(match.kickoff).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return (
    <div className={`match-card ${highlight ? "is-highlight" : ""}`}>
      {/* Local */}
      <div className="flex flex-1 min-w-0 items-center gap-2">
        <TeamBadge initials={match.home_short} color={match.home_color} />
        <div className="font-display text-[0.875rem] font-bold uppercase tracking-wide text-foreground truncate">
          {match.home_team}
        </div>
      </div>

      {/* Score inputs */}
      <div className="flex flex-col items-center flex-shrink-0">
        {time && (
          <span className="text-[0.55rem] font-bold tracking-[0.1em] text-muted-foreground mb-0.5">
            {time}
          </span>
        )}
        <div className="flex items-center gap-1">
        <label className="score-box">
          <span className="sr-only">Goles {match.home_team}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={homeScore}
            onChange={handle("h")}
            disabled={disabled}
            placeholder="-"
          />
        </label>
        <span className="text-base font-bold text-muted-foreground">·</span>
        <label className="score-box">
          <span className="sr-only">Goles {match.away_team}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={awayScore}
            onChange={handle("a")}
            disabled={disabled}
            placeholder="-"
          />
        </label>
        </div>
      </div>

      {/* Visitante */}
      <div className="flex flex-1 min-w-0 flex-row-reverse items-center gap-2 text-right">
        <TeamBadge initials={match.away_short} color={match.away_color} />
        <div className="font-display text-[0.875rem] font-bold uppercase tracking-wide text-foreground truncate">
          {match.away_team}
        </div>
      </div>
    </div>
  );
}
