import { NextRequest, NextResponse } from 'next/server'

/**
 * Domaine(s) réservés à l'estimateur client.
 * Configurer dans Vercel : Settings → Environment Variables → CUSTOMER_DOMAIN
 * Exemple : CUSTOMER_DOMAIN=estimer.gestionnaf.ca
 * Plusieurs domaines (séparés par virgule) : CUSTOMER_DOMAIN=estimer.gestionnaf.ca,estimation.gestionnaf.ca
 *
 * Si la variable est absente, le middleware est transparent — tout passe normalement.
 */
const CUSTOMER_DOMAINS = (process.env.CUSTOMER_DOMAIN ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

/** Routes autorisées sur le domaine client */
const ESTIMATEUR_PREFIXES = ['/estimateur', '/api/estimate', '/api/lead']

function isCustomerDomain(host: string): boolean {
  if (CUSTOMER_DOMAINS.length === 0) return false
  const h = host.toLowerCase().replace(/:\d+$/, '') // strip port
  return CUSTOMER_DOMAINS.includes(h)
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  // Domaine Builder AI interne → aucune restriction
  if (!isCustomerDomain(host)) {
    return NextResponse.next()
  }

  // Racine du domaine client → redirige vers l'estimateur
  if (pathname === '/' || pathname === '') {
    return NextResponse.redirect(new URL('/estimateur', request.url))
  }

  // Tunnel estimateur + ses API → laisser passer
  if (ESTIMATEUR_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Tout le reste (dashboard, login, signup, chat…) → redirige vers estimateur
  return NextResponse.redirect(new URL('/estimateur', request.url))
}

export const config = {
  /*
   * Appliqué à tous les chemins sauf :
   * - fichiers statiques Next.js (_next/static, _next/image)
   * - assets publics courants (favicon, images, fonts, manifests)
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2?|ttf|otf|json)).*)',
  ],
}
