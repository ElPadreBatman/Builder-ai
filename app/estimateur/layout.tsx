import type { ReactNode } from 'react'
import Script from 'next/script'

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
      {/* Cal.com embed — loads after page is interactive, then scans for data-cal-link buttons */}
      <Script
        id="cal-embed-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(C,A,L){let p=function(a,ar){a.q.push(ar)};let d=C.document;C.Cal=C.Cal||function(){let cal=C.Cal;let ar=arguments;if(!cal.loaded){cal.ns={};cal.q=cal.q||[];d.head.appendChild(d.createElement("script")).src=A;cal.loaded=true}if(ar[0]===L){const api=function(){p(api,arguments)};const namespace=ar[1];api.q=api.q||[];if(typeof namespace==="string"){cal.ns[namespace]=cal.ns[namespace]||api;p(cal.ns[namespace],ar);p(cal,[L,ar[1],ar[2]])}else p(cal,ar);return}p(cal,ar)};})(window,"https://app.cal.com/embed/embed.js","init");
Cal("init","visite",{origin:"https://app.cal.com"});
Cal.ns["visite"]("ui",{"hideEventTypeDetails":false,"layout":"month_view"});`,
        }}
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
