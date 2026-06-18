import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)

function isValidOrigin(origin: string | null): boolean {
  if (!origin) return false
  if (ALLOWED_ORIGINS.length === 0) {
    return origin.includes('localhost') || (SUPABASE_URL ? origin.includes(new URL(SUPABASE_URL).hostname) : false)
  }
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed.replace(/\/+$/, '')))
}

function redirectBase(origin: string | null): string {
  if (origin && isValidOrigin(origin)) return origin
  return SUPABASE_URL ? new URL(SUPABASE_URL).origin : ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No token' }), { status: 401, headers: corsHeaders })

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Server config error' }), { status: 500, headers: corsHeaders })
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const origin = req.headers.get('origin')
    if (!isValidOrigin(origin)) {
      return new Response(JSON.stringify({ error: 'Origen no autorizado' }), { status: 403, headers: corsHeaders })
    }

    const { torneo_id, concepto, monto, equipo_id } = await req.json()

    if (!concepto || typeof concepto !== 'string') {
      return new Response(JSON.stringify({ error: 'Concepto requerido' }), { status: 400, headers: corsHeaders })
    }
    if (!monto || typeof monto !== 'number' || monto <= 0 || monto > 100000) {
      return new Response(JSON.stringify({ error: 'Monto invalido (1-100000)' }), { status: 400, headers: corsHeaders })
    }
    if (!torneo_id) {
      return new Response(JSON.stringify({ error: 'torneo_id requerido' }), { status: 400, headers: corsHeaders })
    }

    // Verify torneo exists
    const { data: torneo } = await supabase.from('torneos').select('id').eq('id', torneo_id).maybeSingle()
    if (!torneo) {
      return new Response(JSON.stringify({ error: 'Torneo no encontrado' }), { status: 400, headers: corsHeaders })
    }

    // Verify equipo exists if provided
    if (equipo_id) {
      const { data: equipo } = await supabase.from('equipos').select('id').eq('id', equipo_id).maybeSingle()
      if (!equipo) {
        return new Response(JSON.stringify({ error: 'Equipo no encontrado' }), { status: 400, headers: corsHeaders })
      }
    }

    const { data: pago, error: insertError } = await supabase
      .from('pagos')
      .insert({ torneo_id, usuario_id: user.id, equipo_id, concepto, monto, estado: 'pendiente' })
      .select()
      .single()

    if (insertError) throw insertError

    if (!MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN no configurado')
    }

    const baseUrl = redirectBase(origin)

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
        notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
        back_urls: {
          success: `${baseUrl}/delegado`,
          failure: `${baseUrl}/delegado`,
          pending: `${baseUrl}/delegado`
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
