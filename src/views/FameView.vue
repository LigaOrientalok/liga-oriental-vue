<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTorneoStore } from '../stores/torneoStore'
import { useAuthStore } from '../stores/authStore'
import { db } from '../lib/db'

const torneo = useTorneoStore()
const auth = useAuthStore()

const jugadores = ref([])
const equipos = ref([])
const loading = ref(false)
const selectedPlayer = ref(null)

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%2330363d' width='150' height='150'/%3E%3Ctext fill='%238b949e' font-family='sans-serif' font-size='14' text-anchor='middle' x='75' y='85'%3ESin Foto%3C/text%3E%3C/svg%3E"

const XP_PER_LEVEL = 80

function calcularXP(j) {
  let xp = 0
  xp += (j.goles || 0) * 10
  xp += (j.pj || 0) * 5
  xp += (j.mvps || 0) * 25
  xp += (j.vallas_invictas || 0) * 15
  xp += (j.hattricks || 0) * 40
  xp += (j.dobletes || 0) * 20
  xp += (j.pokers || 0) * 80
  xp += (j.matches_con_gol || 0) * 5
  xp += (j.wins || 0) * 8
  xp += (j.clean_wins || 0) * 10
  xp += (j.brace_mvp || 0) * 30
  xp += (j.hattrick_mvp || 0) * 50
  xp += (j.poker_mvp || 0) * 100
  return xp
}

function calcularNivel(xp) { return Math.floor(Math.sqrt(xp / XP_PER_LEVEL)) + 1 }

function xpParaSiguienteNivel(nivel) { return XP_PER_LEVEL * (nivel * nivel) }

function getNivelColor(nivel) {
  if (nivel >= 12) return '#8b5cf6'
  if (nivel >= 9) return '#eab308'
  if (nivel >= 6) return '#94a3b8'
  if (nivel >= 3) return '#cd7f32'
  return '#8b949e'
}

function getNivelLabel(nivel) {
  if (nivel >= 12) return 'LEYENDA'
  if (nivel >= 9) return 'ORO'
  if (nivel >= 6) return 'PLATA'
  if (nivel >= 3) return 'BRONCE'
  return 'PRINCIPIANTE'
}

function calcularRating(j) {
  let media = 60 + ((j.goles || 0) * 0.5) + ((j.pj || 0) * 0.2) + ((j.mvps || 0) * 2.0)
  media -= ((j.amarillas || 0) * 0.5) + ((j.rojas || 0) * 2.0)
  media += calcularNivel(calcularXP(j)) * 0.5
  return Math.min(99, Math.max(10, Math.round(media)))
}

const cracks = computed(() => {
  return [...jugadores.value].sort((a, b) => (b.mvps || 0) - (a.mvps || 0) || (b.goles || 0) - (a.goles || 0)).slice(0, 12)
})

const championTeams = computed(() => {
  if (equipos.value.length === 0) return []
  const maxPts = Math.max(...equipos.value.filter(e => e.pj > 0).map(e => e.pts || 0))
  return equipos.value.filter(e => (e.pts || 0) === maxPts && e.pj > 0).map(e => e.id)
})

function logoEq(j) {
  const eqId = j.equipos?.[0]
  const eq = equipos.value.find(e => e.id === eqId)
  return eq?.logo || ''
}

import bronzeCard from '../assets/cards/BRONZE.jpg'
import plataCard from '../assets/cards/plata.png'
import oroCard from '../assets/cards/oro.jpg'
import diamanteCard from '../assets/cards/diamante.png'

function getCardBg(nivel) {
  if (nivel >= 12) return `url(${diamanteCard})`
  if (nivel >= 9) return `url(${oroCard})`
  if (nivel >= 6) return `url(${plataCard})`
  if (nivel >= 3) return `url(${bronzeCard})`
  return 'none'
}

function getFrameClass(nivel, esCampeon) {
  if (esCampeon) return 'frame-campeon'
  if (nivel >= 12) return 'frame-diamante'
  if (nivel >= 9) return 'frame-oro'
  if (nivel >= 6) return 'frame-plata'
  if (nivel >= 3) return 'frame-bronce'
  return ''
}

function openPlayerDetail(j) {
  selectedPlayer.value = j
}

function closePlayerDetail() {
  selectedPlayer.value = null
}

function getPlayerEquipos(j) {
  return (j.equipos || []).map(eId => equipos.value.find(e => e.id === eId)).filter(Boolean)
}

function posMap(p) {
  const map = { POR: 'Portero', DFC: 'Defensa', MC: 'Mediocampista', DEL: 'Delantero' }
  return map[p] || p
}

function pieMap(p) {
  return p === 'R' ? 'Diestro' : p === 'L' ? 'Zurdo' : p
}

async function loadData() {
  if (!torneo.torneoActual) return
  loading.value = true
  try {
    const [j, e] = await Promise.all([
      db.getJugadores(torneo.torneoActual),
      db.getEquipos(torneo.torneoActual)
    ])
    jugadores.value = j
    equipos.value = e
  } finally {
    loading.value = false
  }
}

watch(() => torneo.torneoActual, async () => {
  if (torneo.torneoActual) await loadData()
})

onMounted(async () => {
  if (torneo.torneoActual) await loadData()
})
</script>

<template>
  <section>
    <div v-if="loading" class="box" style="text-align:center; color:#b0bcc4;">Cargando...</div>
    <div v-else-if="cracks.length === 0" class="box" style="text-align:center; color:#8b949e;">
      No hay jugadores en este torneo
    </div>
    <div v-else class="box">
      <h3>🏆 SALÓN DE LA FAMA</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:20px; margin-top:15px;">
        <div
          v-for="j in cracks"
          :key="j.id"
          class="ficha-ea"
          :class="getFrameClass(calcularNivel(calcularXP(j)), championTeams.length > 0 && (j.equipos || []).some(eId => championTeams.includes(eId)))"
          :style="{ backgroundImage: getCardBg(calcularNivel(calcularXP(j))) }"
          style="cursor:pointer;"
          @click="openPlayerDetail(j)"
        >
          <div class="card-badge">
            <div class="rating">{{ calcularRating(j) }}</div>
            <div class="pos">{{ j.posicion }}</div>
          </div>
          <img :src="j.foto || DEFAULT_AVATAR" class="perfil-ea foto-frame">
          <span
            style="position:absolute;top:20px;right:20px;color:black;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:bold;z-index:5;"
            :style="{ background: getNivelColor(calcularNivel(calcularXP(j))) }"
          >
            Lv.{{ calcularNivel(calcularXP(j)) }}
          </span>
          <span
            v-if="championTeams.length > 0 && (j.equipos || []).some(eId => championTeams.includes(eId))"
            style="position:absolute;top:18px;left:18px;font-size:1.8rem;z-index:5;filter:drop-shadow(0 0 6px rgba(234,179,8,0.8));"
          >👑</span>
          <img
            v-if="logoEq(j)"
            :src="logoEq(j)"
            style="position:absolute;bottom:80px;right:10px;width:32px;height:32px;border-radius:50%;border:2px solid #eab308;background:#0d1117;object-fit:cover;"
            @error="$event.target.style.display='none'"
          >
          <div class="info-jugador-ea">
            <h3>{{ j.nombre }}</h3>
            <div class="stats-ea">
              <span>⚽ {{ j.goles || 0 }}</span>
              <span>⭐ {{ j.mvps || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Player Detail Overlay -->
    <div
      v-if="selectedPlayer"
      style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:1000;"
      @click.self="closePlayerDetail"
    >
      <div style="background:#161b22; border:2px solid #eab308; border-radius:16px; padding:30px; max-width:520px; width:90%; max-height:90vh; overflow-y:auto; position:relative;">
        <button @click="closePlayerDetail" style="position:absolute;top:10px;right:10px;background:#ef4444;color:white;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1.2rem;">✕</button>

        <div style="text-align:center; margin-bottom:20px;">
          <div style="display:inline-block; position:relative;">
            <img :src="selectedPlayer.foto || DEFAULT_AVATAR" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #eab308;margin-bottom:10px;">
            <span
              style="position:absolute;bottom:8px;right:-4px;color:black;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:bold;z-index:5;white-space:nowrap;"
              :style="{ background: getNivelColor(calcularNivel(calcularXP(selectedPlayer))) }"
            >Lv.{{ calcularNivel(calcularXP(selectedPlayer)) }}</span>
          </div>
          <h2 style="color:#eab308; margin:5px 0;">{{ selectedPlayer.nombre }}</h2>
          <div style="display:flex; justify-content:center; gap:10px; margin:5px 0;">
            <span style="background:#3b82f6; padding:2px 12px; border-radius:4px; font-size:0.8rem;">{{ posMap(selectedPlayer.posicion) }}</span>
            <span style="background:#30363d; padding:2px 12px; border-radius:4px; font-size:0.8rem;">{{ pieMap(selectedPlayer.pierna) }}</span>
          </div>
          <div style="display:flex; justify-content:center; gap:10px; margin-top:8px; flex-wrap:wrap;">
            <div
              v-for="eq in getPlayerEquipos(selectedPlayer)"
              :key="eq.id"
              style="display:flex; align-items:center; gap:5px; background:#0d1117; padding:4px 12px; border-radius:20px; border:1px solid #30363d;"
            >
              <img v-if="eq.logo" :src="eq.logo" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">
              <span style="font-size:0.8rem; color:#b0bcc4;">{{ eq.nombre }}</span>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:10px;">
          <div style="background:#0d1117; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#22c55e;">{{ selectedPlayer.goles || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">GOLES</div>
          </div>
          <div style="background:#0d1117; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#3b82f6;">{{ selectedPlayer.pj || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">PARTIDOS</div>
          </div>
          <div style="background:#0d1117; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ calcularRating(selectedPlayer) }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">RATING</div>
          </div>
          <div style="background:#0d1117; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#f97316;">{{ selectedPlayer.mvps || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">MVP</div>
          </div>
          <div style="background:#0d1117; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ selectedPlayer.amarillas || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">AMARILLAS</div>
          </div>
          <div style="background:#0d1117; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#ef4444;">{{ selectedPlayer.rojas || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">ROJAS</div>
          </div>
        </div>

        <div v-if="selectedPlayer" style="background:#0d1117; border-radius:8px; padding:15px; margin-bottom:10px; text-align:center;">
          <div style="display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:8px;">
            <span style="font-size:2rem; font-weight:bold;" :style="{ color: getNivelColor(calcularNivel(calcularXP(selectedPlayer))) }">
              {{ calcularNivel(calcularXP(selectedPlayer)) }}
            </span>
            <span
              style="color:black; padding:4px 16px; border-radius:20px; font-weight:bold; font-size:0.75rem;"
              :style="{ background: getNivelColor(calcularNivel(calcularXP(selectedPlayer))) }"
            >{{ getNivelLabel(calcularNivel(calcularXP(selectedPlayer))) }}</span>
          </div>
          <div style="background:#21262d; border-radius:10px; height:16px; overflow:hidden; margin-bottom:4px;">
            <div
              style="height:100%; border-radius:10px; transition:width 0.5s;"
              :style="{
                width: Math.min(100, ((calcularXP(selectedPlayer) - xpParaSiguienteNivel(calcularNivel(calcularXP(selectedPlayer)) - 1)) / (xpParaSiguienteNivel(calcularNivel(calcularXP(selectedPlayer))) - xpParaSiguienteNivel(calcularNivel(calcularXP(selectedPlayer)) - 1))) * 100) + '%',
                background: 'linear-gradient(90deg, ' + getNivelColor(calcularNivel(calcularXP(selectedPlayer))) + ', #eab308)'
              }"
            ></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#8b949e;">
            <span>{{ calcularXP(selectedPlayer) }} XP</span>
            <span>{{ xpParaSiguienteNivel(calcularNivel(calcularXP(selectedPlayer))) }} XP</span>
          </div>
        </div>

        <div style="background:#0d1117; border-radius:8px; padding:15px;">
          <h4 style="color:#eab308; margin:0 0 10px 0;">📊 Estadísticas</h4>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:0.85rem;">
            <span style="color:#8b949e;">Goles por partido:</span>
            <span style="color:white; font-weight:bold; text-align:right;">
              {{ selectedPlayer.pj > 0 ? (selectedPlayer.goles / selectedPlayer.pj).toFixed(2) : '0.00' }}
            </span>
            <span style="color:#8b949e;">MVP por partido:</span>
            <span style="color:white; font-weight:bold; text-align:right;">
              {{ selectedPlayer.pj > 0 ? (selectedPlayer.mvps / selectedPlayer.pj).toFixed(2) : '0.00' }}
            </span>
            <span style="color:#8b949e;">Efectividad:</span>
            <span style="color:white; font-weight:bold; text-align:right;">
              {{ selectedPlayer.goles > 0 ? ((selectedPlayer.mvps / selectedPlayer.goles) * 100).toFixed(0) : '0' }}% MVP
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
