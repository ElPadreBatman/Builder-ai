import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { invitationId } = await request.json()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role, company, email").eq("id", user.id).single()

    if (!profile || !["admin", "director"].includes(profile.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Get invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("company", profile.company)
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Invitation non trouvée" }, { status: 404 })
    }

    // Check if invitation is still valid
    if (invitation.accepted_at) {
      return NextResponse.json({ error: "Cette invitation a déjà été acceptée" }, { status: 400 })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: "Cette invitation a expiré" }, { status: 400 })
    }

    const invitationLink = `https://v0-chat-interface-with-open-ai-theta.vercel.app/accept-invitation?token=${invitation.token}`

    // Resend email
    try {
      await resend.emails.send({
        from: "Gestion AF <noreply@gestion-af.ca>",
        to: invitation.email,
        subject: "Rappel : Invitation à rejoindre l'équipe",
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
                <h1 style="margin: 0;">Rappel : Invitation à rejoindre l'équipe</h1>
              </div>
              <div class="content">
                <p>Bonjour,</p>
                <p>Ceci est un rappel de votre invitation à rejoindre <strong>${profile.company}</strong> sur notre plateforme de chat IA.</p>
                <p>Pour accepter cette invitation et créer votre compte, cliquez sur le bouton ci-dessous :</p>
                <div style="text-align: center;">
                  <a href="${invitationLink}" class="button">Accepter l'invitation</a>
                </div>
                <p style="font-size: 14px; color: #6b7280;">Ou copiez ce lien dans votre navigateur :</p>
                <p style="font-size: 12px; word-break: break-all; background: white; padding: 10px; border-radius: 4px;">
                  ${invitationLink}
                </p>
                <div class="footer">
                  <p><strong>Note :</strong> Cette invitation expire le ${new Date(invitation.expires_at).toLocaleDateString("fr-FR")}.</p>
                  <p>Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      })

      return NextResponse.json({ success: true, message: "Email renvoyé avec succès" })
    } catch (emailError) {
      console.error("Error resending email:", emailError)
      return NextResponse.json({ error: "Erreur lors de l'envoi de l'email" }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] Error in resend invitation:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
