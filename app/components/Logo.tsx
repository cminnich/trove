type LogoProps = {
  size?: number
  className?: string
  variant?: 'light' | 'dark' | 'auto'
}

export function Logo({ size = 120, className = '', variant = 'auto' }: LogoProps) {
  const viewBox = '0 0 100 100'

  // Determine colors based on variant
  const isDark = variant === 'dark'
  const isLight = variant === 'light'

  // Node fill: white for light mode, carbon for dark mode
  const nodeFill = variant === 'auto'
    ? 'var(--color-carbon)'  // Uses CSS variable that inverts
    : isLight
      ? '#FFFFFF'
      : '#1A1A1A'

  // Heart layer (ghost network) styling
  const heartOpacity = isLight ? 0.35 : isDark ? 0.4 : 0.35
  const heartStroke = isLight ? 1.2 : isDark ? 1 : 1.2

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Trove - Personal Knowledge Graph"
    >
      {/* Heart layer - emotional/personal context */}
      <g opacity={heartOpacity}>
        <path
          d="M20 30L10 50M10 50L50 85M80 30L90 50M90 50L50 85M35 15L20 30M65 15L80 30M50 30L35 15M50 30L65 15"
          stroke="var(--color-indigo-accent, #6366F1)"
          strokeWidth={heartStroke}
          strokeLinejoin="round"
        />
        <circle cx="10" cy="50" r="2.5" fill="var(--color-indigo-accent, #6366F1)"/>
        <circle cx="90" cy="50" r="2.5" fill="var(--color-indigo-accent, #6366F1)"/>
        <circle cx="35" cy="15" r="2.5" fill="var(--color-indigo-accent, #6366F1)"/>
        <circle cx="65" cy="15" r="2.5" fill="var(--color-indigo-accent, #6366F1)"/>
      </g>

      {/* Primary T structure - factual/objective data */}
      <path
        d="M20 30H80M50 30V85"
        stroke="var(--color-indigo-accent, #6366F1)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Primary T nodes */}
      <circle cx="20" cy="30" r="6" fill={nodeFill} stroke="var(--color-indigo-accent, #6366F1)" strokeWidth="3"/>
      <circle cx="80" cy="30" r="6" fill={nodeFill} stroke="var(--color-indigo-accent, #6366F1)" strokeWidth="3"/>
      <circle cx="50" cy="30" r="7" fill={nodeFill} stroke="var(--color-indigo-accent, #6366F1)" strokeWidth="3"/>
      <circle cx="50" cy="85" r="6" fill={nodeFill} stroke="var(--color-indigo-accent, #6366F1)" strokeWidth="3"/>

      {/* Center accent dot */}
      <circle cx="50" cy="30" r="2.5" fill="var(--color-indigo-accent, #6366F1)"/>
    </svg>
  )
}

// Icon-only variant for mobile/favicon
export function LogoIcon({ size = 48, className = '' }: Pick<LogoProps, 'size' | 'className'>) {
  return (
    <Logo size={size} className={className} />
  )
}
