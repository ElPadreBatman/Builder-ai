import type { ReactNode } from 'react'

export default function EstimateurLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Barlow Condensed loaded at runtime (browser request, not build-time) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&display=swap"
      />
      <div
        style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
          background: 'linear-gradient(160deg, #07101f 0%, #0d1b3e 55%, #070d1a 100%)',
          minHeight: '100vh',
        }}
      >
        {children}
      </div>
    </>
  )
}
