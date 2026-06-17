import { NextRequest, NextResponse } from 'next/server'

const N8N_WEBHOOK = 'https://gestionaf.app.n8n.cloud/webhook/c19810b8-eedc-47c9-9065-1419bc1f34d9'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const webhookUrl = process.env.N8N_WEBHOOK_URL ?? N8N_WEBHOOK

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      console.error('[lead] Webhook n8n failed:', res.status, await res.text())
    } else {
      console.log('[lead] Lead envoyé à n8n avec succès')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[lead] Erreur envoi webhook:', error)
    // Toujours retourner 200 — ne jamais bloquer l'UX sur une erreur webhook
    return NextResponse.json({ ok: true })
  }
}
