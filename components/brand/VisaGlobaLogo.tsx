type VisaGlobaLogoProps = {
  className?: string
  title?: string
  tone?: "light" | "green"
}

export default function VisaGlobaLogo({
  className,
  title = "VisaGloba",
  tone = "green",
}: VisaGlobaLogoProps) {
  const primary = tone === "light" ? "#d9f8e7" : "#0b4f36"
  const secondary = tone === "light" ? "#9fddb1" : "#4f8b5f"

  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
    >
      <circle cx="37" cy="20" r="12" fill={primary} />
      <circle cx="68" cy="34" r="10" fill={secondary} />

      <path
        d="M9 78C13 42 31 31 52 38C58 50 58 65 51 79C35 84 21 83 9 78Z"
        fill={primary}
      />
      <path
        d="M19 75C29 61 41 50 53 43"
        stroke={tone === "light" ? "#064e3b" : "#f8fbf7"}
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity={tone === "light" ? 0.34 : 1}
      />

      <path
        d="M50 78C54 46 67 35 87 39C92 57 85 76 66 86C58 84 53 81 50 78Z"
        fill={secondary}
      />
      <path
        d="M59 78C68 63 77 52 87 43"
        stroke={tone === "light" ? "#064e3b" : "#f8fbf7"}
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity={tone === "light" ? 0.3 : 1}
      />
    </svg>
  )
}
