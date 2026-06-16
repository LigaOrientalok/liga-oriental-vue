import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  try {
    if (req.method === 'GET') {
      const { id, topic } = Object.fromEntries(new URL(req.url).searchParams)
      if (topic === 'payment' && id) {
        await procesarPago(id)
      }
      return new Response('ok')
    }

    const body = await req.json()
    console.log('Webhook MP recibido:', JSON.stringify(body))

    const type = body.type || body.action
    const dataId = body.data?.id || body.id

    if ((type === 'payment' || type === 'payment.update' || type === 'payment.created') && dataId) {
      await procesarPago(String(dataId))
    }

    return new Response('ok')
  } catch (err) {
    console.error('Error en webhook:', err)
    return new Response('ok', { status: 200 })
  }
})

async function procesarPago(paymentId: string) {
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
