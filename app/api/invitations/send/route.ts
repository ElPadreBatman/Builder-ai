import { createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { randomUUID } from "crypto"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { email, company } = await request.json()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, company, subscription_type, email")
      .eq("id", user.id)
      .single()

    console.log("[v0] User profile:", profile, "Error:", profileError)

    if (!profile || !["admin", "director"].includes(profile.role)) {
      return NextResponse.json({ error: "Accès refusé - Vous devez être administrateur ou directeur" }, { status: 403 })
    }

    // Check subscription limits
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("company", profile.company)

    const limits = {
      base: 1,
      professionnel: 3,
      entreprise: 10,
    }

    const currentLimit = limits[profile.subscription_type as keyof typeof limits] || 1

    if ((count || 0) >= currentLimit) {
      return NextResponse.json(
        {
          error: `Limite d'utilisateurs atteinte pour l'abonnement ${profile.subscription_type} (${currentLimit} max)`,
        },
        { status: 400 },
      )
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, invitation_status")
      .eq("email", email)
      .single()

    if (existingProfile && existingProfile.invitation_status === "active") {
      return NextResponse.json({ error: "Cet email est déjà utilisé par un compte actif" }, { status: 400 })
    }

    // Check if invitation already exists
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("id")
      .eq("email", email)
      .is("accepted_at", null)
      .maybeSingle()

    if (existingInvitation) {
      return NextResponse.json({ error: "Une invitation existe déjà pour cet email" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (existingProfile) {
      // Update existing profile with pending status
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          company: profile.company,
          invitation_status: "pending",
        })
        .eq("id", existingProfile.id)

      if (updateError) {
        console.error("[v0] Error updating profile to pending:", updateError)
      }
    }
    // Note: If no existing profile, it will be created when user accepts invitation

    // Create invitation
    const token = randomUUID()

    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("invitations")
      .insert({
        email,
        company: profile.company,
        invited_by: user.id,
        token: token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (inviteError) {
      console.error("[v0] Error creating invitation:", inviteError.message)
      return NextResponse.json({ error: "Erreur lors de la création de l'invitation" }, { status: 500 })
    }

    const invitationLink = `https://v0-chat-interface-with-open-ai-theta.vercel.app/accept-invitation?token=${token}`

    console.log("[v0] Invitation created:", { id: invitation.id, token, email, company: profile.company })

    try {
      await resend.emails.send({
        from: "Gestion AF <noreply@gestion-af.ca>",
        to: email,
        subject: "Invitation à rejoindre l'équipe",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 10px 10px 0 0;
                  text-align: center;
                }
                .content {
                  background: #f9fafb;
                  padding: 30px;
                  border-radius: 0 0 10px 10px;
                }
                .button {
                  display: inline-block;
                  background: #667eea;
                  color: white;
                  padding: 14px 28px;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: 600;
                  margin: 20px 0;
                }
                .footer {
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  font-size: 14px;
                  color: #6b7280;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1 style="margin: 0;">Invitation à rejoindre l'équipe</h1>
              </div>
              <div class="content">
                <p>Bonjour,</p>
                <p><strong>${profile.email}</strong> vous invite à rejoindre <strong>${profile.company}</strong> sur notre plateforme de chat IA.</p>
                <p>Pour accepter cette invitation et créer votre compte, cliquez sur le bouton ci-dessous :</p>
                <div style="text-align: center;">
                  <a href="${invitationLink}" class="button">Accepter l'invitation</a>
                </div>
                <p style="font-size: 14px; color: #6b7280;">Ou copiez ce lien dans votre navigateur :</p>
                <p style="font-size: 12px; word-break: break-all; background: white; padding: 10px; border-radius: 4px;">
                  ${invitationLink}
                </p>
                <div class="footer">
                  <p><strong>Note :</strong> Cette invitation expire dans 7 jours.</p>
                  <p>Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      })
    } catch (emailError) {
      console.error("Error sending email:", emailError)
    }

    return NextResponse.json({ invitation, invitationLink })
  } catch (error) {
    console.error("[v0] Error in send invitation:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
