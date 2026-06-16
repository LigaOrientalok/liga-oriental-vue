<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useTorneoStore } from '../stores/torneoStore'
import { useToastStore } from '../stores/toastStore'
import { db } from '../lib/db'

const auth = useAuthStore()
const torneo = useTorneoStore()
const toast = useToastStore()

const activeTab = ref('equipo')

const equipo = ref(null)
const jugadores = ref([])
const fixture = ref([])
const resultados = ref([])
const sanciones = ref([])
const pagos = ref([])
const loading = ref(true)

const equipoId = computed(() => auth.userData?.equipo_id)

const jugadoresDelEquipo = computed(() => {
  if (!equipoId.value) return []
  return jugadores.value.filter(j => j.equipos?.includes(equipoId.value))
})

const proximosPartidos = computed(() => {
  if (!equipoId.value) return []
  const ids = [equipoId.value]
  return fixture.value
    .filter(f => (ids.includes(f.equipo_local_id) || ids.includes(f.equipo_visitante_id)) &&
      !resultados.value.some(r => r.fixture_id === f.id))
    .map(f => ({
      ...f,
      local_nombre: torneo.equipos.find(e => e.id === f.equipo_local_id)?.nombre || 'Local',
      visit_nombre: torneo.equipos.find(e => e.id === f.equipo_visitante_id)?.nombre || 'Visitante',
      es_local: f.equipo_local_id === equipoId.value
    }))
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
})

const partidosJugados = computed(() => {
  if (!equipoId.value) return []
  const ids = [equipoId.value]
  const res = fixture.value
    .filter(f => ids.includes(f.equipo_local_id) || ids.includes(f.equipo_visitante_id))
    .map(f => {
      const r = resultados.value.find(x => x.fixture_id === f.id)
      if (!r) return null
      const local = torneo.equipos.find(e => e.id === f.equipo_local_id)?.nombre || 'Local'
      const visit = torneo.equipos.find(e => e.id === f.equipo_visitante_id)?.nombre || 'Visitante'
      const ganado = (f.equipo_local_id === equipoId.value && r.goles_local > r.goles_visitante) ||
                     (f.equipo_visitante_id === equipoId.value && r.goles_visitante > r.goles_local)
      return { ...f, local_nombre: local, visit_nombre: visit, resultado: r, ganado }
    })
    .filter(Boolean)
  return res
})

const sancionesDelEquipo = computed(() => {
  if (!equipoId.value) return []
  const jugadorIds = jugadoresDelEquipo.value.map(j => j.id)
  return sanciones.value
    .filter(s => jugadorIds.includes(s.jugador_id) && s.activa)
    .map(s => {
      const jug = jugadores.value.find(j => j.id === s.jugador_id)
      return { ...s, jugador_nombre: jug?.nombre || 'Desconocido' }
    })
})

const totalPendiente = computed(() => {
  return pagos.value
    .filter(p => p.estado === 'pendiente')
    .reduce((sum, p) => sum + Number(p.monto), 0)
})

async function cargarDatos() {
  if (!torneo.torneoActual || !equipoId.value) { loading.value = false; return }
  loading.value = true
  try {
    const [eq, jg, fx, rs, sn, pg] = await Promise.all([
      db.getEquipos(torneo.torneoActual),
      db.getJugadores(torneo.torneoActual),
      db.getFixture(torneo.torneoActual),
      db.getResultados(torneo.torneoActual),
      db.getSanciones(torneo.torneoActual),
      db.getPagosByEquipo(equipoId.value)
    ])
    equipo.value = eq.find(e => e.id === equipoId.value) || null
    jugadores.value = jg
    fixture.value = fx
    resultados.value = rs
    sanciones.value = sn
    pagos.value = pg
  } catch (e) { toast.error('Error al cargar datos') }
  finally { loading.value = false }
}

// Mercado Pago
const mpMonto = ref(0)
const mpConcepto = ref('')
const mpGenerando = ref(false)

async function generarPagoMP() {
  if (!mpMonto.value || mpMonto.value <= 0) return toast.error('Ingresá un monto válido')
  if (!mpConcepto.value.trim()) return toast.error('Ingresá un concepto')
  mpGenerando.value = true
  try {
    const session = await supabase.auth.getSession()
    const token = session?.data?.session?.access_token
    if (!token) { toast.error('Sesión expirada'); return }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-create-preference`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          torneo_id: torneo.torneoActual,
          concepto: mpConcepto.value.trim(),
          monto: mpMonto.value,
          equipo_id: equipoId.value
        })
      }
    )
    const result = await response.json()
    if (result.init_point) {
      window.open(result.init_point, '_blank')
      toast.success('✅ Redirigiendo a Mercado Pago...')
      await cargarDatos()
    } else {
      toast.error('Error al crear el pago: ' + (result.error || 'Error desconocido'))
    }
  } catch (e) {
    toast.error('Error de conexión')
  } finally {
    mpGenerando.value = false
  }
}

const tabs = [
  { id: 'equipo', label: 'Mi Equipo' },
  { id: 'partidos', label: 'Partidos' },
  { id: 'sanciones', label: 'Sanciones' },
  { id: 'pagos', label: 'Pagos' }
]

watch(() => torneo.torneoActual, async () => {
  if (torneo.torneoActual) await cargarDatos()
})

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const mpStatus = params.get('status')
  const mpPaymentId = params.get('payment_id')

  if (mpStatus && mpPaymentId) {
    if (mpStatus === 'approved') {
      await supabase.from('pagos').update({
        estado: 'aprobado',
        mp_payment_id: mpPaymentId,
        mp_status: 'approved',
        fecha_pago: new Date().toISOString()
      }).eq('mp_preference_id', params.get('preference_id') || '')
      toast.success('✅ Pago aprobado')
    } else if (mpStatus === 'pending') {
      toast.info('⏳ Pago pendiente')
    } else {
      toast.error('❌ Pago rechazado o cancelado')
    }

    const cleanUrl = window.location.pathname
    window.history.replaceState({}, '', cleanUrl)
  }

  if (torneo.torneoActual) await cargarDatos()
})
</script>

<template>
  <section>
    <div v-if="!equipoId" class="box" style="text-align:center; padding:40px;">
      <h3 style="color:#f97316; margin-bottom:15px;">👔 No tenés equipo asignado</h3>
      <p style="color:var(--text-muted);">El administrador debe asignarte un equipo para acceder a esta sección.</p>
    </div>

    <template v-else>
      <div class="box" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <img
            v-if="equipo?.logo"
            :src="equipo.logo"
            style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid var(--gold);"
          />
          <div>
            <h3 style="color:var(--gold); margin:0;">👔 Panel Delegado</h3>
            <p style="color:var(--text-muted); font-size:0.85rem; margin:2px 0 0;">
              {{ equipo?.nombre || 'Sin equipo' }} | {{ jugadoresDelEquipo.length }} jugadores
            </p>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:15px; flex-wrap:wrap; border-bottom:2px solid var(--border); padding-bottom:10px;">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="btn-mini"
          :style="{ background: activeTab === tab.id ? '#eab308' : 'var(--border)', color: activeTab === tab.id ? 'black' : 'white' }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- MI EQUIPO -->
      <div v-if="activeTab === 'equipo'" style="margin-top:15px;">
        <div v-if="loading" class="spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
        <template v-else>
          <div class="box">
            <h3 style="color:var(--gold); margin-bottom:15px;">{{ equipo?.nombre }}</h3>
            <div v-if="equipo" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px;">
              <div class="box" style="text-align:center; padding:12px;">
                <h3 style="color:#3b82f6; margin:0;">{{ equipo.pj || 0 }}</h3>
                <p style="color:var(--text-muted); font-size:0.75rem; margin:4px 0 0;">PJ</p>
              </div>
              <div class="box" style="text-align:center; padding:12px;">
                <h3 style="color:#22c55e; margin:0;">{{ equipo.v || 0 }}</h3>
                <p style="color:var(--text-muted); font-size:0.75rem; margin:4px 0 0;">Victorias</p>
              </div>
              <div class="box" style="text-align:center; padding:12px;">
                <h3 style="color:#f97316; margin:0;">{{ equipo.e || 0 }}</h3>
                <p style="color:var(--text-muted); font-size:0.75rem; margin:4px 0 0;">Empates</p>
              </div>
              <div class="box" style="text-align:center; padding:12px;">
                <h3 style="color:#ef4444; margin:0;">{{ equipo.p || 0 }}</h3>
                <p style="color:var(--text-muted); font-size:0.75rem; margin:4px 0 0;">Derrotas</p>
              </div>
              <div class="box" style="text-align:center; padding:12px;">
                <h3 style="color:var(--gold); margin:0;">{{ equipo.pts || 0 }}</h3>
                <p style="color:var(--text-muted); font-size:0.75rem; margin:4px 0 0;">PTS</p>
              </div>
            </div>
          </div>

          <div class="box">
            <h3 style="color:var(--gold); margin-bottom:15px;">Jugadores ({{ jugadoresDelEquipo.length }})</h3>
            <div v-if="jugadoresDelEquipo.length === 0" style="color:var(--text-muted);">Sin jugadores asignados</div>
            <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px;">
              <div v-for="j in jugadoresDelEquipo" :key="j.id"
                style="background:var(--bg-input); border-radius:8px; padding:12px; display:flex; align-items:center; gap:10px; border-left:3px solid var(--gold);"
              >
                <img
                  :src="j.foto || ''"
                  style="width:36px; height:36px; border-radius:50%; object-fit:cover; background:var(--border);"
                  @error="$event.target.style.display='none'"
                />
                <div>
                  <strong style="color:white; font-size:0.9rem;">{{ j.nombre }}</strong>
                  <span style="display:block; color:var(--text-muted); font-size:0.75rem;">
                    {{ j.posicion || 'Sin posición' }} | ⚽ {{ j.goles || 0 }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- PARTIDOS -->
      <div v-if="activeTab === 'partidos'" style="margin-top:15px;">
        <div v-if="loading" class="spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
        <template v-else>
          <div class="box">
            <h3 style="color:#22c55e; margin-bottom:15px;">📅 Próximos Partidos</h3>
            <div v-if="proximosPartidos.length === 0" style="color:var(--text-muted);">No hay partidos pendientes</div>
            <div v-for="f in proximosPartidos" :key="f.id" class="fixture-item pendiente">
              <div>
                <span style="font-weight:600;">{{ f.local_nombre }}</span>
                <span style="color:var(--text-muted); margin:0 10px;">vs</span>
                <span style="font-weight:600;">{{ f.visit_nombre }}</span>
              </div>
              <span style="color:var(--gold); font-size:0.85rem;">{{ f.fecha }} {{ f.hora }}</span>
            </div>
          </div>

          <div class="box">
            <h3 style="color:#3b82f6; margin-bottom:15px;">📋 Historial de Partidos</h3>
            <div v-if="partidosJugados.length === 0" style="color:var(--text-muted);">Sin partidos jugados</div>
            <div v-for="f in partidosJugados" :key="f.id" class="fixture-item" :class="f.ganado ? 'finalizado' : ''"
              :style="{ borderLeftColor: f.ganado ? '#22c55e' : '#ef4444' }"
>
              <div>
                <span :style="{ fontWeight: 600, color: f.es_local ? 'white' : 'var(--text-muted)' }">{{ f.local_nombre }}</span>
                <span style="color:var(--text-muted); margin:0 10px;">vs</span>
                <span :style="{ fontWeight: 600, color: !f.es_local ? 'white' : 'var(--text-muted)' }">{{ f.visit_nombre }}</span>
              </div>
              <span style="font-weight:bold; color:#22c55e;">
                {{ f.resultado.goles_local }} - {{ f.resultado.goles_visitante }}
              </span>
            </div>
          </div>
        </template>
      </div>

      <!-- SANCIONES -->
      <div v-if="activeTab === 'sanciones'" style="margin-top:15px;">
        <div v-if="loading" class="spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
        <template v-else>
          <div class="box">
            <h3 style="color:#ef4444; margin-bottom:15px;">⚠️ Sanciones Activas ({{ sancionesDelEquipo.length }})</h3>
            <div v-if="sancionesDelEquipo.length === 0" style="color:var(--text-muted); text-align:center; padding:20px;">
              No hay sanciones activas para tu equipo
            </div>
            <div v-for="s in sancionesDelEquipo" :key="s.id"
              style="background:var(--bg-input); border-radius:8px; padding:12px; margin-bottom:8px; border-left:4px solid;"
              :style="{ borderLeftColor: s.tipo === 'suspension' ? '#ef4444' : '#f97316' }"
            >
              <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                  <strong style="color:white;">{{ s.jugador_nombre }}</strong>
                  <span style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:600; text-transform:uppercase;"
                    :style="{ background: s.tipo === 'suspension' ? '#ef4444' : '#f97316', color: 'white' }"
                  >{{ s.tipo === 'suspension' ? '🔴 Suspendido' : '🟡 Amonestado' }}</span>
                </div>
              </div>
              <p style="margin:6px 0 0; color:var(--text-accent); font-size:0.85rem;">{{ s.motivo }}</p>
              <div style="margin-top:4px; font-size:0.75rem; color:var(--text-muted);">
                {{ s.fecha_inicio ? new Date(s.fecha_inicio).toLocaleDateString('es-ES') : '-' }} →
                {{ s.fecha_fin ? new Date(s.fecha_fin).toLocaleDateString('es-ES') : 'indefinido' }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- PAGOS -->
      <div v-if="activeTab === 'pagos'" style="margin-top:15px;">
        <div v-if="loading" class="spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
        <template v-else>
          <div class="box" style="border-left:4px solid #8b5cf6;">
            <h3 style="color:#8b5cf6; margin-bottom:10px;">💰 Pagos vía Mercado Pago</h3>
            <div v-if="totalPendiente > 0" style="background:rgba(234,179,8,0.1); border:1px solid rgba(234,179,8,0.3); border-radius:8px; padding:12px; margin-bottom:15px;">
              <p style="color:var(--gold); font-weight:600;">
                Total pendiente: <strong style="font-size:1.2rem;">${{ totalPendiente.toLocaleString('es-AR') }}</strong>
              </p>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
              <div>
                <label class="label-accent">Concepto:</label>
                <select v-model="mpConcepto" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
                  <option value="">Seleccionar...</option>
                  <option value="Cuota mensual">Cuota mensual</option>
                  <option value="Inscripción">Inscripción</option>
                  <option value="Multa">Multa</option>
                  <option value="Fondo de equipo">Fondo de equipo</option>
                </select>
              </div>
              <div>
                <label class="label-accent">Monto ($):</label>
                <input type="number" v-model.number="mpMonto" min="1" placeholder="Ej: 5000" />
              </div>
            </div>
            <button class="btn-main" @click="generarPagoMP" :disabled="mpGenerando" style="background:#8b5cf6; color:white;">
              {{ mpGenerando ? '⏳ Generando...' : '💳 PAGAR CON MERCADO PAGO' }}
            </button>
          </div>

          <div class="box">
            <h3 style="color:var(--gold); margin-bottom:15px;">📋 Historial de Pagos</h3>
            <div v-if="pagos.length === 0" style="color:var(--text-muted); text-align:center; padding:20px;">Sin pagos registrados</div>
            <div v-for="p in pagos" :key="p.id"
              style="background:var(--bg-input); border-radius:8px; padding:12px; margin-bottom:8px; border-left:4px solid;"
              :style="{ borderLeftColor: p.estado === 'pagado' ? '#22c55e' : p.estado === 'pendiente' ? '#f97316' : '#ef4444' }"
            >
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="color:white;">{{ p.concepto }}</strong>
                  <span style="display:block; color:var(--text-muted); font-size:0.8rem;">
                    {{ new Date(p.fecha_creacion).toLocaleDateString('es-ES') }}
                  </span>
                </div>
                <div style="text-align:right;">
                  <strong style="color:#22c55e; font-size:1.1rem;">${{ Number(p.monto).toLocaleString('es-AR') }}</strong>
                  <span style="display:block; font-size:0.75rem; text-transform:uppercase;"
                    :style="{ color: p.estado === 'pagado' ? '#22c55e' : p.estado === 'pendiente' ? '#f97316' : '#ef4444' }"
                  >{{ p.estado }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </section>
</template>
