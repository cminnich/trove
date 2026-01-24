import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Trove',
    short_name: 'Trove',
    description: 'Your collections, AI-ready',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0f0f',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
