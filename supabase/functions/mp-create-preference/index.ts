import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No token' }), { status: 401 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { torneo_id, concepto, monto, equipo_id } = await req.json()

    if (!concepto || !monto || monto <= 0) {
      return new Response(JSON.stringify({ error: 'Faltan datos: concepto y monto requeridos' }), { status: 400 })
    }

    const { data: pago, error: insertError } = await supabase
      .from('pagos')
      .insert({ torneo_id, usuario_id: user.id, equipo_id, concepto, monto, estado: 'pendiente' })
      .select()
      .single()

    if (insertError) throw insertError

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        items: [{
          title: concepto,
          quantity: 1,
          currency_id: 'UYU',
          unit_price: Number(monto)
        }],
        back_urls: {
          success: `${req.headers.get('origin') || ''}/delegado`,
          failure: `${req.headers.get('origin') || ''}/delegado`,
          pending: `${req.headers.get('origin') || ''}/delegado`
        },
        auto_return: 'approved',
        external_reference: pago.id.toString()
      })
    })

    const pref = await mpResponse.json()

    if (pref.id) {
      await supabase.from('pagos').update({ mp_preference_id: pref.id }).eq('id', pago.id)
    }

    return new Response(JSON.stringify({ preference_id: pref.id, init_point: pref.init_point }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
