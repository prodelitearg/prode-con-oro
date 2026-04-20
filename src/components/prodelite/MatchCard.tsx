import { TeamBadge } from "./TeamBadge";

export interface MatchData {
  id: string;
  home_team: string;
  home_short: string;
  home_color: string;
  away_team: string;
  away_short: string;
  away_color: string;
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

  return (
    <div className={`match-card ${highlight ? "is-highlight" : ""}`}>
      {/* Local */}
      <div className="flex flex-1 items-center gap-3">
        <TeamBadge initials={match.home_short} color={match.home_color} />
        <div className="leading-tight">
          <div className="font-display text-base font-bold uppercase tracking-wide text-foreground">
            {match.home_team}
          </div>
          <div className="font-display text-[0.6rem] font-semibold tracking-[0.15em] uppercase text-muted-foreground mt-0.5">
            Local
          </div>
        </div>
      </div>

      {/* Score inputs */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
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
        <span className="text-xl font-bold text-muted-foreground">·</span>
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

      {/* Visitante */}
      <div className="flex flex-1 flex-row-reverse items-center gap-3 text-right">
        <TeamBadge initials={match.away_short} color={match.away_color} />
        <div className="leading-tight">
          <div className="font-display text-base font-bold uppercase tracking-wide text-foreground">
            {match.away_team}
          </div>
          <div className="font-display text-[0.6rem] font-semibold tracking-[0.15em] uppercase text-muted-foreground mt-0.5">
            Visitante
          </div>
        </div>
      </div>
    </div>
  );
}
