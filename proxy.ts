import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { i18n, type Locale } from "@/lib/i18n/config"

const PUBLIC_FILE = /\.(.*)$/

function getLocaleFromHeaders(request: NextRequest): Locale {
  // Check cookie first (user preference)
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value
  if (cookieLocale && i18n.locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale
  }

  // Parse Accept-Language header
  const acceptLanguage = request.headers.get("Accept-Language")
  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code, priority] = lang.trim().split(";q=")
        return {
          code: code.split("-")[0].toLowerCase(),
          priority: priority ? parseFloat(priority) : 1,
        }
      })
      .sort((a, b) => b.priority - a.priority)

    for (const lang of languages) {
      if (i18n.locales.includes(lang.code as Locale)) {
        return lang.code as Locale
      }
    }
  }

  return i18n.defaultLocale
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // ===== I18N LOCALE HANDLING =====
  // Check if this is a path that should have locale prefix
  const nonLocalizedPaths = [
    "/login", "/signup", "/chat", "/dashboard", "/settings", "/profile",
    "/pricing", "/demo", "/projects", "/submissions", "/subscription",
    "/help", "/forgot-password", "/reset-password", "/verify-email",
    "/auth", "/api", "/accept-invitation", "/seller", "/change-password"
  ]
  
  const isNonLocalizedPath = nonLocalizedPaths.some(p => 
    pathname === p || pathname.startsWith(p + "/")
  )
  
  const isStaticFile = PUBLIC_FILE.test(pathname) || 
    pathname.startsWith("/_next/") || 
    pathname === "/favicon.ico"
  
  // Check if pathname already has a locale
  const pathnameHasLocale = i18n.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )
  
  // If path needs locale redirect (root path or locale-prefixed paths)
  if (!isStaticFile && !isNonLocalizedPath && !pathnameHasLocale && pathname === "/") {
    const locale = getLocaleFromHeaders(request)
    const newUrl = new URL(`/${locale}`, request.url)
    const response = NextResponse.redirect(newUrl)
    response.cookies.set("NEXT_LOCALE", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 })
    return response
  }
  
  // Set locale cookie if visiting a localized path
  if (pathnameHasLocale) {
    const currentLocale = pathname.split("/")[1] as Locale
    const response = NextResponse.next({ request })
    if (request.cookies.get("NEXT_LOCALE")?.value !== currentLocale) {
      response.cookies.set("NEXT_LOCALE", currentLocale, { path: "/", maxAge: 60 * 60 * 24 * 365 })
    }
    // Continue with auth checks below but return this response
  }

  // ===== SUPABASE AUTH HANDLING =====
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Handle Supabase auth redirects - redirect code/token_hash from root to auth callback
  const url = request.nextUrl
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type")
  
  // If we have auth params at the root URL, redirect to auth callback
  if (url.pathname === "/" && (code || tokenHash)) {
    const callbackUrl = new URL("/auth/callback", request.url)
    if (code) callbackUrl.searchParams.set("code", code)
    if (tokenHash) callbackUrl.searchParams.set("token_hash", tokenHash)
    if (type) callbackUrl.searchParams.set("type", type)
    // For password reset, redirect to change-password after auth
    if (type === "recovery") {
      callbackUrl.searchParams.set("next", "/change-password")
    }
    return NextResponse.redirect(callbackUrl)
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    // In preview environments, env vars may not be available in proxy
    // Allow the request to continue - auth is handled in pages and API routes
    return NextResponse.next({
      request,
    })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require authentication (including locale-prefixed)
  const publicRoutes = ["/", "/login", "/signup", "/auth", "/accept-invitation", "/api", "/pricing", "/demo", "/seller", "/fr", "/en", "/es"]
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + "/")
  )

  if (!user && !isPublicRoute) {
    // no user, redirect to login
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Check subscription status for /chat route
  if (user && request.nextUrl.pathname.startsWith("/chat")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, trial_end_date, subscription_end_date")
      .eq("id", user.id)
      .single()

    if (profile) {
      const now = new Date()
      const isTrialExpired = profile.trial_end_date && new Date(profile.trial_end_date) < now
      const isSubscriptionExpired = profile.subscription_end_date && new Date(profile.subscription_end_date) < now

      // If no active subscription and trial expired, redirect to pricing
      if (profile.subscription_status !== "active" && isTrialExpired && isSubscriptionExpired) {
        const url = request.nextUrl.clone()
        url.pathname = "/pricing"
        url.searchParams.set("expired", "true")
        return NextResponse.redirect(url)
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
