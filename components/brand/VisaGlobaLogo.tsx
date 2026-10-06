type VisaGlobaLogoProps = {
  className?: string
  title?: string
}

export default function VisaGlobaLogo({
  className,
  title = "VisaGloba",
}: VisaGlobaLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
    >
      <circle cx="38" cy="19" r="11" fill="#0b4f36" />
      <circle cx="70" cy="34" r="10" fill="#6fa77a" />

      <path
        d="M11 77C14 44 30 33 50 38C56 47 58 61 54 76C39 83 25 83 11 77Z"
        fill="#0b4f36"
      />
      <path
        d="M18 75C29 60 41 50 55 44"
        stroke="#f8fbf7"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <path
        d="M52 78C54 47 67 36 86 39C91 57 84 76 66 86C60 84 55 81 52 78Z"
        fill="#4f8b5f"
      />
      <path
        d="M59 78C68 63 77 52 87 43"
        stroke="#f8fbf7"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}
