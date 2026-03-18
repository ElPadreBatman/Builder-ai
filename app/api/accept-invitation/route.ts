import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  console.log("[v0] === Accept invitation API called ===")

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("[v0] Error parsing request JSON:", parseError)
      return NextResponse.json({ error: "Format de requête invalide" }, { status: 400 })
    }

    const { token, email, password, firstName, lastName } = body

    console.log("[v0] Accept invitation request:", {
      email,
      hasToken: !!token,
      hasPassword: !!password,
      firstName,
      lastName,
    })

    if (!token || !email || !password || !firstName || !lastName) {
      console.error("[v0] Missing required fields:", {
        hasToken: !!token,
        hasEmail: !!email,
        hasPassword: !!password,
        hasFirstName: !!firstName,
        hasLastName: !!lastName,
      })
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[v0] Missing Supabase environment variables:", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
      })
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 })
    }

    console.log("[v0] Creating Supabase admin client...")
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    console.log("[v0] Validating invitation token:", token)
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .is("accepted_at", null)
      .single()

    if (invitationError || !invitation) {
      console.error("[v0] Invitation error:", invitationError)
      return NextResponse.json({ error: "Invitation invalide ou expirée" }, { status: 400 })
    }

    console.log("[v0] Invitation valid:", { email: invitation.email, company: invitation.company })

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      console.log("[v0] Invitation expired:", invitation.expires_at)
      return NextResponse.json({ error: "Cette invitation a expiré" }, { status: 400 })
    }

    const { data: pendingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, company, invitation_status")
      .eq("email", email)
      .maybeSingle()

    console.log("[v0] Pending profile check:", pendingProfile)

    // ALWAYS use the company from the invitation - it takes priority
    const userCompany = invitation.company
    console.log("[v0] User will be assigned to company from invitation:", userCompany)

    console.log("[v0] Checking if user already exists in auth...")
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === email)

    let userId: string

    if (existingUser) {
      console.log("[v0] User already exists in auth:", existingUser.id)
      userId = existingUser.id

      // Update user password and confirm email
      console.log("[v0] Updating existing user password and confirming email...")
      const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          company: userCompany,
          role: "employee",
        },
      })

      if (updateUserError) {
        console.error("[v0] Error updating user:", updateUserError)
        return NextResponse.json(
          { error: "Erreur lors de la mise à jour du compte: " + updateUserError.message },
          { status: 400 },
        )
      }
    } else {
      console.log("[v0] Creating new user with admin.createUser (email already confirmed)...")
      const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          company: userCompany,
          role: "employee",
        },
      })

      if (createUserError || !authData.user) {
        console.error("[v0] Error creating user:", createUserError)
        return NextResponse.json(
          { error: createUserError?.message || "Erreur lors de la création du compte" },
          { status: 400 },
        )
      }

      userId = authData.user.id
      console.log("[v0] User created successfully:", userId)
    }

    console.log("[v0] Updating profile for user:", userId, "with company:", userCompany)

    if (pendingProfile) {
      // Update the existing pending profile with the auth user id and activate it
      // ALWAYS override company with invitation.company
      const { error: updateProfileError } = await supabaseAdmin
        .from("profiles")
        .update({
          id: userId,
          first_name: firstName,
          last_name: lastName,
          company: invitation.company, // Force company from invitation
          invitation_status: "active",
        })
        .eq("email", email)

      if (updateProfileError) {
        console.error("[v0] Error updating pending profile:", updateProfileError)
        // Try upsert as fallback
        const { error: upsertError } = await supabaseAdmin.from("profiles").upsert(
          {
            id: userId,
            email,
            company: userCompany,
            role: "employee",
            first_name: firstName,
            last_name: lastName,
            invitation_status: "active",
          },
          { onConflict: "id" },
        )
        if (upsertError) {
          console.error("[v0] Error upserting profile:", upsertError)
          return NextResponse.json(
            { error: "Erreur lors de la création du profil: " + upsertError.message },
            { status: 400 },
          )
        }
      }
    } else {
      // Create new profile with correct company from invitation
      const { error: upsertError } = await supabaseAdmin.from("profiles").upsert(
        {
          id: userId,
          email,
          company: invitation.company, // Always use invitation.company for new profiles
          role: "employee",
          first_name: firstName,
          last_name: lastName,
          invitation_status: "active",
        },
        { onConflict: "id" },
      )

      if (upsertError) {
        console.error("[v0] Error creating profile:", upsertError)
        return NextResponse.json(
          { error: "Erreur lors de la création du profil: " + upsertError.message },
          { status: 400 },
        )
      }
    }

    console.log("[v0] Profile created/updated successfully with company:", userCompany)

    const { error: updateError } = await supabaseAdmin
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("token", token)

    if (updateError) {
      console.error("[v0] Error updating invitation:", updateError)
    }

    console.log("[v0] Invitation accepted successfully")

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Error in accept-invitation API:", err)
    return NextResponse.json(
      { error: "Erreur serveur: " + (err instanceof Error ? err.message : "Inconnue") },
      { status: 500 },
    )
  }
}
