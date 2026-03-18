import { createClient } from "@/lib/supabase/server"
import { getPlanById, type PlanType } from "@/lib/subscription"

export interface SubscriptionStatus {
  isActive: boolean
  isPastDue: boolean
  isTrialing: boolean
  isCanceled: boolean
  canCreateSoumission: boolean
  canCreateProject: boolean
  remainingSoumissions: number
  remainingProjects: number
  planType: PlanType
  daysUntilExpiry: number
  message?: string
}

export async function checkSubscriptionStatus(): Promise<SubscriptionStatus> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      isActive: false,
      isPastDue: false,
      isTrialing: false,
      isCanceled: true,
      canCreateSoumission: false,
      canCreateProject: false,
      remainingSoumissions: 0,
      remainingProjects: 0,
      planType: "free",
      daysUntilExpiry: 0,
      message: "Vous devez etre connecte pour utiliser cette fonctionnalite.",
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      subscription_type,
      subscription_status,
      subscription_end_date,
      trial_end_date,
      soumissions_this_month,
      usage_reset_date
    `)
    .eq("id", user.id)
    .single()

  if (!profile) {
    return {
      isActive: false,
      isPastDue: false,
      isTrialing: false,
      isCanceled: true,
      canCreateSoumission: false,
      canCreateProject: false,
      remainingSoumissions: 0,
      remainingProjects: 0,
      planType: "free",
      daysUntilExpiry: 0,
      message: "Profil non trouve.",
    }
  }

  const planType = (profile.subscription_type || "free") as PlanType
  const plan = getPlanById(planType)
  const status = profile.subscription_status || "trialing"
  
  const isTrialing = status === "trialing"
  const isPastDue = status === "past_due"
  const isCanceled = status === "canceled"
  const isActive = status === "active" || isTrialing

  // Calculate days until expiry
  let daysUntilExpiry = 0
  if (isTrialing && profile.trial_end_date) {
    daysUntilExpiry = Math.max(0, Math.ceil(
      (new Date(profile.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ))
  } else if (profile.subscription_end_date) {
    daysUntilExpiry = Math.max(0, Math.ceil(
      (new Date(profile.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ))
  }

  // Check if trial has expired
  if (isTrialing && daysUntilExpiry <= 0) {
    return {
      isActive: false,
      isPastDue: false,
      isTrialing: false,
      isCanceled: true,
      canCreateSoumission: false,
      canCreateProject: false,
      remainingSoumissions: 0,
      remainingProjects: 0,
      planType,
      daysUntilExpiry: 0,
      message: "Votre periode d'essai est terminee. Veuillez choisir un plan pour continuer.",
    }
  }

  // Calculate remaining usage
  const soumissionsLimit = plan?.features.soumissionsPerMonth || 0
  const soumissionsUsed = profile.soumissions_this_month || 0
  const remainingSoumissions = soumissionsLimit === -1 ? 999 : Math.max(0, soumissionsLimit - soumissionsUsed)
  
  const projectsLimit = plan?.features.projectsPerMonth || 0
  const remainingProjects = projectsLimit === -1 ? 999 : projectsLimit // Would need to count from DB

  const canCreateSoumission = isActive && !isPastDue && remainingSoumissions > 0
  const canCreateProject = isActive && !isPastDue

  let message: string | undefined
  if (isPastDue) {
    message = "Votre paiement est en retard. Veuillez mettre a jour vos informations de paiement."
  } else if (isCanceled) {
    message = "Votre abonnement est annule. Veuillez vous reabonner pour continuer."
  } else if (!canCreateSoumission && remainingSoumissions <= 0) {
    message = "Vous avez atteint votre limite mensuelle de soumissions. Passez au plan Pro pour des soumissions illimitees."
  } else if (isTrialing && daysUntilExpiry <= 2) {
    message = `Votre essai gratuit se termine dans ${daysUntilExpiry} jour(s). Abonnez-vous maintenant pour continuer.`
  }

  return {
    isActive,
    isPastDue,
    isTrialing,
    isCanceled,
    canCreateSoumission,
    canCreateProject,
    remainingSoumissions,
    remainingProjects,
    planType,
    daysUntilExpiry,
    message,
  }
}

export async function incrementSoumissionUsage(userId: string): Promise<boolean> {
  const supabase = await createClient()
  
  // Get current month in YYYY-MM format
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  // Get profile for plan type
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_type")
    .eq("id", userId)
    .single()

  if (!profile) return false

  const plan = getPlanById((profile.subscription_type || "free") as PlanType)
  const limit = plan?.features.soumissionsPerMonth || 0
  
  // Get or create subscription_usage record for this month
  const { data: usage } = await supabase
    .from("subscription_usage")
    .select("id, soumissions_count")
    .eq("user_id", userId)
    .eq("month_year", currentMonth)
    .single()

  const currentCount = usage?.soumissions_count || 0

  // Check if unlimited (-1) or under limit
  if (limit === -1 || currentCount < limit) {
    if (usage) {
      // Update existing record
      await supabase
        .from("subscription_usage")
        .update({ 
          soumissions_count: currentCount + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", usage.id)
    } else {
      // Insert new record for this month
      await supabase
        .from("subscription_usage")
        .insert({
          user_id: userId,
          month_year: currentMonth,
          soumissions_count: 1,
          projects_count: 0
        })
    }
    
    // Also update profiles for backward compatibility (display purposes)
    await supabase
      .from("profiles")
      .update({ soumissions_this_month: currentCount + 1 })
      .eq("id", userId)
    
    return true
  }

  return false
}

export async function getSoumissionUsageForMonth(userId: string): Promise<number> {
  const supabase = await createClient()
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  const { data } = await supabase
    .from("subscription_usage")
    .select("soumissions_count")
    .eq("user_id", userId)
    .eq("month_year", currentMonth)
    .single()

  return data?.soumissions_count || 0
}
