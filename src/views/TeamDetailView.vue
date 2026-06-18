<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useTorneoStore } from '../stores/torneoStore'
import { useAuthStore } from '../stores/authStore'
import { db } from '../lib/db'
import { calcularRating } from '../lib/playerStats'

const route = useRoute()
const router = useRouter()
const torneo = useTorneoStore()

const equipo = ref(null)
const jugadores = ref([])
const fixture = ref([])
const resultados = ref([])
const loading = ref(true)
const auth = useAuthStore()

const tab = ref('info')
const mensajes = ref([])
const msgText = ref('')
const chatLoading = ref(false)
let chatSub = null

async function loadChat() {
  if (!equipo.value) return
  chatLoading.value = true
  try { mensajes.value = await db.getMensajes(equipo.value.id) }
  finally { chatLoading.value = false }
}

function subscribeChat() {
  if (chatSub) chatSub.unsubscribe()
  if (!equipo.value) return
  chatSub = supabase
    .channel(`chat-${equipo.value.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `equipo_id=eq.${equipo.value.id}` }, async () => {
      mensajes.value = await db.getMensajes(equipo.value.id)
      await nextTick()
      const el = document.querySelector('.chat-scroll')
      if (el) el.scrollTop = el.scrollHeight
    })
    .subscribe()
}

async function enviarMsg() {
  const text = msgText.value.trim()
  if (!text || !equipo.value) return
  msgText.value = ''
  await db.enviarMensaje(equipo.value.id, text)
}

onUnmounted(() => { if (chatSub) chatSub.unsubscribe() })

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%2330363d' width='150' height='150'/%3E%3Ctext fill='%238b949e' font-family='sans-serif' font-size='14' text-anchor='middle' x='75' y='85'%3ESin Foto%3C/text%3E%3C/svg%3E"

const equipoJugadores = computed(() => {
  if (!equipo.value) return []
  return jugadores.value.filter(j => j.equipos?.includes(equipo.value.id))
})

const partidosEquipo = computed(() => {
  if (!equipo.value) return []
  return fixture.value
    .filter(f => f.equipo_local_id === equipo.value.id || f.equipo_visitante_id === equipo.value.id)
    .map(f => {
      const res = resultados.value.find(r => r.fixture_id === f.id)
      const esLocal = f.equipo_local_id === equipo.value.id
      return {
        ...f,
        resultado: res,
        rival: esLocal ? f.equipo_visitante_id : f.equipo_local_id,
        esLocal,
        golesFavor: res ? (esLocal ? res.goles_local : res.goles_visitante) : null,
        golesContra: res ? (esLocal ? res.goles_visitante : res.goles_local) : null,
      }
    })
    .sort((a, b) => ((a.resultado ? 1 : 0) - (b.resultado ? 1 : 0)))
})

function getEqName(id) {
  const eq = torneo.equipos.find(e => e.id === id)
  return eq ? eq.nombre : `Equipo ${id}`
}

function dif(eq) {
  return (eq.gf || 0) - (eq.gc || 0)
}

async function loadData() {
  if (!torneo.torneoActual || !route.params.id) { loading.value = false; return }
  loading.value = true
  try {
    const [eqs, jgs, fx, rs] = await Promise.all([
      db.getEquipos(torneo.torneoActual),
      db.getJugadores(torneo.torneoActual),
      db.getFixture(torneo.torneoActual),
      db.getResultados(torneo.torneoActual)
    ])
    jugadores.value = jgs
    fixture.value = fx
    resultados.value = rs
    equipo.value = eqs.find(e => e.id === parseInt(route.params.id)) || null
    if (equipo.value) {
      await loadChat()
      subscribeChat()
    }
  } finally { loading.value = false }
}

watch(() => [torneo.torneoActual, route.params.id], async () => {
  await loadData()
})
onMounted(async () => {
  await loadData()
})
</script>

<template>
  <section>
    <button @click="router.back()" class="btn-mini" style="background:var(--btn-bg); color:var(--text); margin-bottom:10px;">← Volver</button>

    <div v-if="loading" class="box spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
    <div v-else-if="!equipo" class="box" style="text-align:center; color:#ef4444; padding:30px;">Equipo no encontrado</div>

    <template v-else>
      <div class="box" style="display:flex; gap:10px; margin-bottom:10px;">
        <button class="btn-mini" :style="{ background: tab === 'info' ? '#eab308' : 'var(--border)', color: tab === 'info' ? 'black' : 'white' }" @click="tab = 'info'">📊 Info</button>
        <button class="btn-mini" :style="{ background: tab === 'chat' ? '#eab308' : 'var(--border)', color: tab === 'chat' ? 'black' : 'white' }" @click="tab = 'chat'">💬 Chat</button>
      </div>

      <template v-if="tab === 'info'">
      <div class="box" style="text-align:center; padding:30px;">
        <div
          v-if="equipo.logo"
          style="width:80px; height:80px; border-radius:50%; overflow:hidden; border:3px solid #eab308; margin:0 auto 15px;"
        >
          <img :src="equipo.logo" loading="lazy" style="width:100%; height:100%; object-fit:cover;" alt="">
        </div>
        <div v-else style="width:80px; height:80px; border-radius:50%; background:var(--border); display:flex; align-items:center; justify-content:center; margin:0 auto 15px; font-size:2rem;">⚽</div>
        <h2 style="color:#eab308; margin:0;">{{ equipo.nombre }}</h2>
        <p style="color:var(--text-muted); margin:5px 0;">{{ equipo.dia_semana }} · {{ equipoJugadores.length }} jugadores</p>

        <div style="display:flex; justify-content:center; gap:20px; margin:20px 0; flex-wrap:wrap;">
          <div style="text-align:center;">
            <div style="font-size:2rem; font-weight:bold; color:#3b82f6;">{{ equipo.pts || 0 }}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">PTS</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:2rem; font-weight:bold; color:white;">{{ equipo.pj || 0 }}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">PJ</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:2rem; font-weight:bold; color:#22c55e;">{{ equipo.v || 0 }}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">V</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:2rem; font-weight:bold; color:#eab308;">{{ equipo.e || 0 }}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">E</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:2rem; font-weight:bold; color:#ef4444;">{{ equipo.p || 0 }}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">P</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:2rem; font-weight:bold; color:#eab308;">{{ dif(equipo) >= 0 ? '+' : '' }}{{ dif(equipo) }}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">DF</div>
          </div>
        </div>

        <div style="display:flex; justify-content:center; gap:15px; color:var(--text-accent); font-size:0.9rem;">
          <span>GF: <b style="color:white;">{{ equipo.gf || 0 }}</b></span>
          <span>GC: <b style="color:white;">{{ equipo.gc || 0 }}</b></span>
          <span>🚫 VI: <b style="color:white;">{{ equipo.vallas_invictas || 0 }}</b></span>
        </div>
      </div>

      <div class="box">
        <h3 style="color:#eab308; margin-bottom:15px;">👥 Jugadores ({{ equipoJugadores.length }})</h3>
        <div v-if="equipoJugadores.length === 0" style="color:var(--text-muted);">Sin jugadores</div>
        <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:8px;">
          <div
            v-for="j in equipoJugadores"
            :key="j.id"
            style="display:flex; align-items:center; gap:10px; background:var(--bg-input); border-radius:8px; padding:10px; cursor:pointer;"
            @click="router.push(`/jugador/${j.id}`)"
          >
            <img :src="j.foto || DEFAULT_AVATAR" loading="lazy" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
            <div style="flex:1; min-width:0;">
              <div style="color:white; font-weight:600; font-size:0.9rem;">{{ j.nombre }}</div>
              <div style="color:var(--text-muted); font-size:0.75rem;">{{ j.posicion || '-' }}</div>
            </div>
            <div style="text-align:center; min-width:30px;">
              <div style="font-size:0.95rem; font-weight:bold; color:#22c55e;">{{ j.goles || 0 }}</div>
              <div style="font-size:0.6rem; color:var(--text-muted);">⚽</div>
            </div>
            <div style="text-align:center; min-width:30px;">
              <div style="font-size:0.95rem; font-weight:bold; color:#eab308;">{{ calcularRating(j) }}</div>
              <div style="font-size:0.6rem; color:var(--text-muted);">📊</div>
            </div>
          </div>
        </div>
      </div>

      <div class="box">
        <h3 style="color:#eab308; margin-bottom:15px;">📋 Partidos</h3>
        <div v-if="partidosEquipo.length === 0" style="color:var(--text-muted);">Sin partidos</div>
        <div
          v-for="p in partidosEquipo"
          :key="p.id"
          class="fixture-item"
          :class="p.resultado ? 'finalizado' : 'pendiente'"
          style="cursor:pointer;"
          @click="router.push('/fixture')"
        >
          <div style="font-size:0.85rem;">
            <div style="font-weight:bold;">
              <span v-if="p.esLocal" style="color:#22c55e;">{{ equipo.nombre }}</span>
              <span v-else>{{ getEqName(p.rival) }}</span>
              <span style="color:var(--text-muted); margin:0 8px;">vs</span>
              <span v-if="!p.esLocal" style="color:#22c55e;">{{ equipo.nombre }}</span>
              <span v-else>{{ getEqName(p.rival) }}</span>
            </div>
            <div style="color:var(--text-muted); font-size:0.75rem;">{{ p.fecha }} {{ p.hora }}</div>
          </div>
          <div>
            <template v-if="p.resultado">
              <span style="font-weight:bold; font-size:1.1rem; color:#eab308;">
                {{ p.golesFavor }} - {{ p.golesContra }}
              </span>
            </template>
            <span v-else style="color:#eab308; font-weight:bold; font-size:0.8rem;">PENDIENTE</span>
          </div>
        </div>
      </div>
      </template>

      <template v-if="tab === 'chat'">
      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">💬 Chat de {{ equipo.nombre }}</h4>
        <div class="chat-scroll" style="max-height:400px; overflow-y:auto; margin-bottom:10px; display:flex; flex-direction:column; gap:6px;">
          <div v-if="chatLoading" style="color:var(--text-muted); text-align:center;">Cargando...</div>
          <div v-else-if="mensajes.length === 0" style="color:var(--text-muted); text-align:center;">Sin mensajes</div>
          <div v-for="m in mensajes" :key="m.id" style="background:var(--bg-input); border-radius:8px; padding:8px;">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
              <strong style="color:#eab308;">{{ m.username }}</strong>
              <span style="color:var(--text-muted);">{{ new Date(m.created_at).toLocaleTimeString('es-UY', { hour:'2-digit', minute:'2-digit' }) }}</span>
            </div>
            <p style="color:white; margin:4px 0 0; font-size:0.85rem;">{{ m.mensaje }}</p>
          </div>
        </div>
        <div v-if="auth.isLoggedIn" style="display:flex; gap:8px;">
          <input v-model="msgText" @keyup.enter="enviarMsg" placeholder="Escribí un mensaje..." style="flex:1; padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
          <button @click="enviarMsg" class="btn-mini" style="background:#eab308; color:black;">Enviar</button>
        </div>
        <p v-else style="color:var(--text-muted); font-size:0.8rem;">Iniciá sesión para chatear</p>
      </div>
      </template>
    </template>
  </section>
</template>
