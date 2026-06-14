import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const webhookUrl = process.env.N8N_WEBHOOK_URL

    if (!webhookUrl) {
      console.log('[lead] N8N_WEBHOOK_URL manquant — mode démo activé')
      console.log('[lead] Payload lead:', JSON.stringify(payload, null, 2))
      return NextResponse.json({ ok: true, mode: 'demo' })
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      console.error('[lead] Webhook n8n failed:', res.status, await res.text())
    } else {
      console.log('[lead] Webhook envoyé avec succès')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[lead] Erreur envoi webhook:', error)
    // Always return 200 — ne jamais bloquer l'UX sur une erreur webhook
    return NextResponse.json({ ok: true })
  }
}
