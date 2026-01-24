import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: 40,
        }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 100 100"
          fill="none"
        >
          {/* Ghost connections */}
          <g opacity="0.3">
            <path
              d="M20 30L10 50M10 50L50 85M80 30L90 50M90 50L50 85M35 15L20 30M65 15L80 30M50 30L35 15M50 30L65 15"
              stroke="#a5b4fc"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="50" r="2.5" fill="#a5b4fc" />
            <circle cx="90" cy="50" r="2.5" fill="#a5b4fc" />
            <circle cx="35" cy="15" r="2.5" fill="#a5b4fc" />
            <circle cx="65" cy="15" r="2.5" fill="#a5b4fc" />
          </g>

          {/* Main structure */}
          <path
            d="M20 30H80M50 30V85"
            stroke="#a5b4fc"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Nodes */}
          <circle cx="20" cy="30" r="6" fill="#1e1b4b" stroke="#a5b4fc" strokeWidth="3" />
          <circle cx="80" cy="30" r="6" fill="#1e1b4b" stroke="#a5b4fc" strokeWidth="3" />
          <circle cx="50" cy="30" r="7" fill="#1e1b4b" stroke="#a5b4fc" strokeWidth="3" />
          <circle cx="50" cy="85" r="6" fill="#1e1b4b" stroke="#a5b4fc" strokeWidth="3" />

          {/* Center dot */}
          <circle cx="50" cy="30" r="2.5" fill="#a5b4fc" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
