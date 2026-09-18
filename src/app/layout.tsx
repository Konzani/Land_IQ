import type { Metadata, Viewport } from 'next'
import { Fraunces, Public_Sans } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-fraunces',
})

const publicSans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-public-sans',
})

export const metadata: Metadata = {
  title: 'LandIQ — land suitability assessment',
  description:
    'Draw a parcel boundary and get a measured soil, terrain and climate profile with a ranked crop suitability assessment, downloadable as a report.',
  openGraph: {
    title: 'LandIQ',
    description: 'Land suitability assessment from a drawn boundary.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#14150F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
