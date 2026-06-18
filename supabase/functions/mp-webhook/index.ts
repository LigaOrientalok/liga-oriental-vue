import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-signature',
  }
}

async function hexDigest(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function validarFirma(req: Request, body: string): Promise<boolean> {
  const clientSecret = Deno.env.get('MP_CLIENT_SECRET')
  if (!clientSecret) return true
  const signature = req.headers.get('x-signature')
  if (!signature) return false
  const parts = Object.fromEntries(signature.split(',').map(p => {
    const [k, v] = p.trim().split('=')
    return [k, v]
  }))
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false
  const dataId = req.headers.get('x-request-id') || ''
  const manifest = `${dataId}${ts}${body}`
  const hash = await hexDigest(clientSecret, manifest)
  return hash === v1
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })

  try {
    const bodyText = await req.text()

    const firmaValida = await validarFirma(req, bodyText)
    if (!firmaValida) {
      console.warn('Firma invalida en webhook MP')
      return new Response('Forbidden', { status: 403, headers: corsHeaders() })
    }

    if (req.method === 'GET') {
      const { id, topic } = Object.fromEntries(new URL(req.url).searchParams)
      if (topic === 'payment' && id) await procesarPago(id)
      return new Response('ok', { headers: corsHeaders() })
    }

    const body = JSON.parse(bodyText)
    console.log('Webhook MP recibido:', JSON.stringify(body))
    const type = body.type || body.action
    const dataId = body.data?.id || body.id

    if ((type === 'payment' || type === 'payment.update' || type === 'payment.created') && dataId) {
      await procesarPago(String(dataId))
    }

    return new Response('ok', { headers: corsHeaders() })
  } catch (err) {
    console.error('Error en webhook:', err)
    return new Response('ok', { status: 200, headers: corsHeaders() })
  }
})

async function procesarPago(paymentId: string) {
  if (!MP_ACCESS_TOKEN) { console.error('MP_ACCESS_TOKEN no configurado'); return }
  const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '')
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
  })
  if (!mpRes.ok) {
    console.error(`Error consultando payment ${paymentId}:`, mpRes.status)
    return
  }

  const payment = await mpRes.json()
  console.log('Payment data:', { id: payment.id, status: payment.status, external_ref: payment.external_reference })

  const pagoId = Number(payment.external_reference)
  if (!pagoId) return

  const mpStatus = payment.status
  let estado: string
  switch (mpStatus) {
    case 'approved':
      estado = 'aprobado'
      break
    case 'pending':
    case 'in_process':
      estado = 'pendiente'
      break
    case 'rejected':
    case 'cancelled':
    case 'refunded':
      estado = 'rechazado'
      break
    default:
      estado = 'pendiente'
  }

  await supabase.from('pagos').update({
    estado,
    mp_payment_id: String(payment.id),
    mp_status: mpStatus,
    fecha_pago: mpStatus === 'approved' ? new Date().toISOString() : null
  }).eq('id', pagoId)
}
