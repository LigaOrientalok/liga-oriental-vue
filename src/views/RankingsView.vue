<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTorneoStore } from '../stores/torneoStore'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { calcularXP, calcularNivel, getNivelColor, calcularRating } from '../lib/playerStats'

const router = useRouter()
const torneo = useTorneoStore()

const jugadores = ref([])
const equipos = ref([])
const fixture = ref([])
const resultados = ref([])
const allGoles = ref([])
const loading = ref(true)
const activeRanking = ref('goleadores')

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%2330363d' width='150' height='150'/%3E%3Ctext fill='%238b949e' font-family='sans-serif' font-size='14' text-anchor='middle' x='75' y='85'%3ESin Foto%3C/text%3E%3C/svg%3E"

const rankings = [
  { id: 'goleadores', label: '⚽ Goleadores', icon: '⚽' },
  { id: 'mvps', label: '⭐ MVPs', icon: '⭐' },
  { id: 'rating', label: '📊 Rating', icon: '📊' },
  { id: 'asistencias', label: '🎯 Asistencias', icon: '🎯' },
  { id: 'equipos', label: '🏆 Equipos', icon: '🏆' },
]

const rankingGoleadores = computed(() => {
  return [...jugadores.value]
    .sort((a, b) => (b.goles || 0) - (a.goles || 0))
    .slice(0, 20)
    .map((j, i) => ({ ...j, rank: i + 1 }))
})

const rankingMVPs = computed(() => {
  return [...jugadores.value]
    .sort((a, b) => (b.mvps || 0) - (a.mvps || 0) || (b.goles || 0) - (a.goles || 0))
    .slice(0, 20)
    .map((j, i) => ({ ...j, rank: i + 1 }))
})

const rankingRating = computed(() => {
  return [...jugadores.value]
    .filter(j => j.pj > 0)
    .sort((a, b) => calcularRating(b) - calcularRating(a))
    .slice(0, 20)
    .map((j, i) => ({ ...j, rank: i + 1 }))
})

const rankingEquipos = computed(() => {
  return [...equipos.value]
    .sort((a, b) => (b.pts || 0) - (a.pts || 0) || ((b.gf || 0) - (b.gc || 0)) - ((a.gf || 0) - (a.gc || 0)))
    .map((e, i) => ({ ...e, rank: i + 1 }))
})

const rankingAsistencias = computed(() => {
  const asistencias = {}
  allGoles.value.forEach(g => {
    const pid = g.jugador_id
    if (pid) asistencias[pid] = (asistencias[pid] || 0) + 1
  })
  return [...jugadores.value]
    .map(j => ({ ...j, asistencias: asistencias[j.id] || 0 }))
    .sort((a, b) => b.asistencias - a.asistencias)
    .slice(0, 20)
    .map((j, i) => ({ ...j, rank: i + 1 }))
})

const currentRanking = computed(() => {
  switch (activeRanking.value) {
    case 'goleadores': return rankingGoleadores.value
    case 'mvps': return rankingMVPs.value
    case 'rating': return rankingRating.value
    case 'equipos': return rankingEquipos.value
    case 'asistencias': return rankingAsistencias.value
    default: return []
  }
})

function logoEq(j) {
  const eqId = j.equipos?.[0]
  if (!eqId) return ''
  const eq = equipos.value.find(e => e.id === eqId)
  return eq?.logo || ''
}

function nombreEq(id) {
  const eq = equipos.value.find(e => e.id === id)
  return eq?.nombre || ''
}

function getPosColor(pos) {
  const colors = { POR: '#f97316', DFC: '#3b82f6', MC: '#22c55e', DEL: '#ef4444' }
  return colors[pos] || 'var(--border)'
}

async function loadData() {
  if (!torneo.torneoActual) { loading.value = false; return }
  loading.value = true
  try {
    const [j, e, fx, rs] = await Promise.all([
      db.getJugadores(torneo.torneoActual),
      db.getEquipos(torneo.torneoActual),
      db.getFixture(torneo.torneoActual),
      db.getResultados(torneo.torneoActual)
    ])
    jugadores.value = j
    equipos.value = e
    fixture.value = fx
    resultados.value = rs

    if (rs.length > 0) {
      const resIds = rs.map(r => r.id)
      const { data: goles } = await supabase.from('goles').select('*').in('resultado_id', resIds)
      allGoles.value = goles || []
    }
  } finally { loading.value = false }
}

watch(() => torneo.torneoActual, async () => {
  await loadData()
})
onMounted(async () => {
  await loadData()
})
</script>

<template>
  <section>
    <div class="box">
      <h3>📈 Rankings</h3>
      <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; border-bottom:2px solid var(--border); padding-bottom:10px;">
        <button
          v-for="r in rankings"
          :key="r.id"
          class="btn-mini"
          :style="{ background: activeRanking === r.id ? '#eab308' : 'var(--border)', color: activeRanking === r.id ? 'black' : 'white' }"
          @click="activeRanking = r.id"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="box spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
    <div v-else-if="currentRanking.length === 0" class="box" style="text-align:center; color:var(--text-muted);">Sin datos</div>

    <!-- Equipos ranking -->
    <template v-else-if="activeRanking === 'equipos'">
      <div class="box">
        <div
          v-for="e in currentRanking"
          :key="e.id"
          style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); cursor:pointer;"
          @click="router.push(`/equipo/${e.id}`)"
        >
          <div style="width:30px; text-align:center; font-weight:bold; font-size:1.1rem;"
            :style="{ color: e.rank <= 3 ? '#eab308' : 'var(--text-muted)' }"
          >#{{ e.rank }}</div>
          <div v-if="e.logo" style="width:36px; height:36px; border-radius:50%; overflow:hidden; flex-shrink:0;">
            <img :src="e.logo" loading="lazy" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div v-else style="width:36px; height:36px; border-radius:50%; background:var(--border); display:flex; align-items:center; justify-content:center; font-size:1rem;">⚽</div>
          <div style="flex:1; font-weight:600; color:white;">{{ e.nombre }}</div>
          <div style="display:flex; gap:12px; font-size:0.85rem; color:var(--text-accent);">
            <span>PJ: {{ e.pj || 0 }}</span>
            <span>DF: <b :style="{ color: ((e.gf||0)-(e.gc||0)) >= 0 ? '#22c55e' : '#ef4444' }">{{ (e.gf||0)-(e.gc||0) }}</b></span>
            <span style="font-weight:bold; color:#eab308; font-size:1rem;">{{ e.pts || 0 }} PTS</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Jugadores ranking -->
    <template v-else>
      <div class="box">
        <div
          v-for="j in currentRanking"
          :key="j.id"
          style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); cursor:pointer;"
          @click="router.push(`/jugador/${j.id}`)"
        >
          <div style="width:30px; text-align:center; font-weight:bold; font-size:1.1rem;"
            :style="{ color: j.rank <= 3 ? '#eab308' : 'var(--text-muted)' }"
          >#{{ j.rank }}</div>
          <div style="position:relative;">
            <img :src="j.foto || DEFAULT_AVATAR" loading="lazy" style="width:42px; height:42px; border-radius:50%; object-fit:cover;">
            <span
              style="position:absolute;bottom:-2px;right:-4px;color:black;padding:1px 6px;border-radius:8px;font-size:0.55rem;font-weight:bold;"
              :style="{ background: getNivelColor(calcularNivel(calcularXP(j))) }"
            >Lv.{{ calcularNivel(calcularXP(j)) }}</span>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="color:white; font-weight:600; font-size:0.9rem;">{{ j.nombre }}</div>
            <div style="display:flex; gap:6px; margin-top:2px;">
              <span :style="{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600', color: 'white', background: getPosColor(j.posicion) }">
                {{ j.posicion }}
              </span>
              <img v-if="logoEq(j)" :src="logoEq(j)" loading="lazy" :title="nombreEq(j.equipos?.[0])" style="width:14px;height:14px;border-radius:50%;object-fit:cover;">
            </div>
          </div>
          <div style="text-align:right; min-width:80px;">
            <template v-if="activeRanking === 'goleadores'">
              <div style="font-size:1.3rem; font-weight:bold; color:#22c55e;">{{ j.goles || 0 }}</div>
              <div style="font-size:0.6rem; color:var(--text-muted);">GOLES</div>
            </template>
            <template v-else-if="activeRanking === 'mvps'">
              <div style="font-size:1.3rem; font-weight:bold; color:#f97316;">{{ j.mvps || 0 }}</div>
              <div style="font-size:0.6rem; color:var(--text-muted);">MVP</div>
            </template>
            <template v-else-if="activeRanking === 'rating'">
              <div style="font-size:1.3rem; font-weight:bold; color:#eab308;">{{ calcularRating(j) }}</div>
              <div style="font-size:0.6rem; color:var(--text-muted);">RATING</div>
            </template>
            <template v-else-if="activeRanking === 'asistencias'">
              <div style="font-size:1.3rem; font-weight:bold; color:#3b82f6;">{{ j.asistencias }}</div>
              <div style="font-size:0.6rem; color:var(--text-muted);">GOLES</div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
