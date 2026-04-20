interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "text-[1.1rem]",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl sm:text-6xl",
} as const;

export function Logo({ size = "md" }: LogoProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        aria-hidden
        className="text-primary text-base"
        style={{ filter: "drop-shadow(0 0 6px oklch(0.80 0.155 88 / 0.8))" }}
      >
        ★
      </div>
      <div className={`pl-logo ${sizeMap[size]}`}>PRODELITE</div>
    </div>
  );
}
