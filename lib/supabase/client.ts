import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

// Fallback for development/preview if env vars are not immediately available
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export function createClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // In development/preview, return a mock client that will be replaced on next render
    if (typeof window !== "undefined") {
      console.warn("[v0] Supabase env vars not yet available, will retry...")
      // Return null to signal client is not ready
      return null as any
    }
    throw new Error(
      "Les variables d'environnement Supabase ne sont pas configurées. Veuillez verifier la section Vars dans la sidebar.",
    )
  }

  supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: false, // Disable lock to prevent "Lock broken by another request" errors
    },
    global: {
      fetch: async (url, options) => {
        const maxRetries = 3
        let lastError: Error | null = null
        
        for (let i = 0; i < maxRetries; i++) {
          try {
            const response = await fetch(url, options)
            return response
          } catch (error) {
            lastError = error as Error
            if (i < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
            }
          }
        }
        
        throw lastError
      }
    }
  })

  return supabaseClient
}

export function resetClient() {
  supabaseClient = null
}
