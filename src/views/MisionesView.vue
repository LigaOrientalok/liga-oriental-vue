<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { useTorneoStore } from '../stores/torneoStore'
import { useAuthStore } from '../stores/authStore'
import { db } from '../lib/db'

const torneo = useTorneoStore()
const auth = useAuthStore()

const jugadores = ref([])
const equipos = ref([])
const loading = ref(false)
const selectedPlayerId = ref(null)
const playerMissions = ref(null)

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

const MISIONES = [
  { id: 'g1', icon: '⚽', label: 'Anotar 1 gol', check: j => j.goles >= 1, xp: 10 },
  { id: 'g5', icon: '⚽⚽', label: 'Anotar 5 goles', check: j => j.goles >= 5, xp: 20 },
  { id: 'g10', icon: '⚽⚽⚽', label: 'Anotar 10 goles', check: j => j.goles >= 10, xp: 30 },
  { id: 'g25', icon: '🎯', label: 'Anotar 25 goles', check: j => j.goles >= 25, xp: 50 },
  { id: 'pj5', icon: '🏃', label: 'Jugar 5 partidos', check: j => j.pj >= 5, xp: 10 },
  { id: 'pj10', icon: '🏃🏃', label: 'Jugar 10 partidos', check: j => j.pj >= 10, xp: 15 },
  { id: 'pj20', icon: '🏃🏃🏃', label: 'Jugar 20 partidos', check: j => j.pj >= 20, xp: 25 },
  { id: 'pj50', icon: '🔥', label: 'Jugar 50 partidos', check: j => j.pj >= 50, xp: 50 },
  { id: 'mvp1', icon: '⭐', label: 'Ser MVP 1 vez', check: j => j.mvps >= 1, xp: 15 },
  { id: 'mvp5', icon: '⭐⭐', label: 'Ser MVP 5 veces', check: j => j.mvps >= 5, xp: 30 },
  { id: 'mvp10', icon: '⭐⭐⭐', label: 'Ser MVP 10 veces', check: j => j.mvps >= 10, xp: 50 },
  { id: 'hat1', icon: '🎩', label: 'Hacer un hat-trick', check: j => j.hattricks >= 1, xp: 40 },
  { id: 'hat3', icon: '🎩🎩', label: 'Hacer 3 hat-tricks', check: j => j.hattricks >= 3, xp: 80 },
  { id: 'dob5', icon: '2️⃣', label: 'Hacer 5 dobletes', check: j => j.dobletes >= 5, xp: 30 },
  { id: 'pok1', icon: '4️⃣', label: 'Hacer un póker', check: j => j.pokers >= 1, xp: 60 },
  { id: 'vi1', icon: '🧤', label: 'Valla invicta', check: j => j.vallas_invictas >= 1, xp: 15 },
  { id: 'vi5', icon: '🧤🧤', label: '5 vallas invictas', check: j => j.vallas_invictas >= 5, xp: 30 },
  { id: 'win5', icon: '✅', label: 'Ganar 5 partidos', check: j => j.wins >= 5, xp: 15 },
  { id: 'win10', icon: '✅✅', label: 'Ganar 10 partidos', check: j => j.wins >= 10, xp: 25 },
  { id: 'bracemvp', icon: '💪', label: 'Doblete + MVP', check: j => j.brace_mvp >= 1, xp: 30 },
  { id: 'hatmvp', icon: '💪💪', label: 'Hat-trick + MVP', check: j => j.hattrick_mvp >= 1, xp: 50 },
  { id: 'pokmvp', icon: '💪💪💪', label: 'Póker + MVP', check: j => j.poker_mvp >= 1, xp: 100 },
  { id: 'clean5', icon: '🧹', label: '5 victorias sin goles', check: j => j.clean_wins >= 5, xp: 30 },
  { id: 'rating80', icon: '📈', label: 'Rating 80+', check: j => calcularRating(j) >= 80, xp: 40 },
  { id: 'rating90', icon: '📈📈', label: 'Rating 90+', check: j => calcularRating(j) >= 90, xp: 80 },
  { id: 'nivel3', icon: '🥉', label: 'Alcanzar nivel 3', check: j => calcularNivel(calcularXP(j)) >= 3, xp: 20 },
  { id: 'nivel6', icon: '🥈', label: 'Alcanzar nivel 6', check: j => calcularNivel(calcularXP(j)) >= 6, xp: 40 },
  { id: 'nivel9', icon: '🥇', label: 'Alcanzar nivel 9', check: j => calcularNivel(calcularXP(j)) >= 9, xp: 70 },
  { id: 'nivel12', icon: '💎', label: 'Alcanzar nivel 12', check: j => calcularNivel(calcularXP(j)) >= 12, xp: 120 },
  { id: 'foto', icon: '📸', label: 'Tener foto', check: j => j.foto && !j.foto.includes('Sin Foto'), xp: 10 },
]

function calcularRating(j) {
  let media = 60 + ((j.goles || 0) * 0.5) + ((j.pj || 0) * 0.2) + ((j.mvps || 0) * 2.0)
  media -= ((j.amarillas || 0) * 0.5) + ((j.rojas || 0) * 2.0)
  media += calcularNivel(calcularXP(j)) * 0.5
  return Math.min(99, Math.max(10, Math.round(media)))
}

const selectedPlayer = computed(() => {
  if (!selectedPlayerId.value) return null
  return jugadores.value.find(j => j.id === parseInt(selectedPlayerId.value))
})

const missions = computed(() => {
  const j = selectedPlayer.value
  if (!j) return []
  return MISIONES.map(m => ({
    ...m,
    completada: m.check(j),
    earned: m.check(j) ? m.xp : 0
  }))
})

const completedMissions = computed(() => missions.value.filter(m => m.completada))
const totalMissionXP = computed(() => missions.value.reduce((s, m) => s + (m.earned || 0), 0))

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
    <div v-else>
      <div class="box">
        <h3>🎯 Misiones</h3>
        <label class="label-accent">Seleccionar Jugador:</label>
        <select v-model="selectedPlayerId" style="padding:10px; border-radius:6px; background:#0d1117; color:white; border:1px solid #30363d;">
          <option :value="null">Seleccionar...</option>
          <option v-for="j in jugadores" :key="j.id" :value="j.id">{{ j.nombre }}</option>
        </select>
      </div>

      <div v-if="!selectedPlayer" class="box" style="text-align:center; color:#8b949e; padding:30px;">
        Seleccioná un jugador para ver sus misiones
      </div>

      <template v-else>
        <!-- Player XP / Level Card -->
        <div class="box">
          <div style="text-align:center;">
            <div style="display:flex; justify-content:center; align-items:center; gap:15px; margin-bottom:10px;">
              <span style="font-size:2.5rem; font-weight:bold;" :style="{ color: getNivelColor(calcularNivel(calcularXP(selectedPlayer))) }">
                {{ calcularNivel(calcularXP(selectedPlayer)) }}
              </span>
              <div>
                <h4 style="color:#eab308; margin:0;">{{ selectedPlayer.nombre }}</h4>
                <span
                  style="color:black; padding:2px 12px; border-radius:12px; font-weight:bold; font-size:0.75rem;"
                  :style="{ background: getNivelColor(calcularNivel(calcularXP(selectedPlayer))) }"
                >{{ getNivelLabel(calcularNivel(calcularXP(selectedPlayer))) }}</span>
              </div>
              <span style="font-size:2rem; font-weight:bold; color:#eab308;">{{ calcularRating(selectedPlayer) }}</span>
            </div>
            <div style="background:#21262d; border-radius:10px; height:20px; overflow:hidden; margin-top:10px;">
              <div
                style="height:100%; border-radius:10px; transition:width 0.5s;"
                :style="{
                  width: Math.min(100, ((calcularXP(selectedPlayer) - xpParaSiguienteNivel(calcularNivel(calcularXP(selectedPlayer)) - 1)) / (xpParaSiguienteNivel(calcularNivel(calcularXP(selectedPlayer))) - xpParaSiguienteNivel(calcularNivel(calcularXP(selectedPlayer)) - 1))) * 100) + '%',
                  background: 'linear-gradient(90deg, ' + getNivelColor(calcularNivel(calcularXP(selectedPlayer))) + ', #eab308)'
                }"
              ></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#8b949e; margin-top:4px;">
              <span>{{ calcularXP(selectedPlayer) }} XP</span>
              <span>Sig. nivel: {{ xpParaSiguienteNivel(calcularNivel(calcularXP(selectedPlayer))) }} XP</span>
            </div>
          </div>
        </div>

        <!-- Missions Grid -->
        <div class="box">
          <h4 style="color:#eab308; margin:0 0 10px 0;">
            🎯 Misiones ({{ completedMissions.length }}/{{ missions.length }})
            <span style="font-size:0.8rem; color:#8b949e; margin-left:10px;">
              +{{ totalMissionXP }} XP de misiones
            </span>
          </h4>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:8px;">
            <div
              v-for="m in missions"
              :key="m.id"
              style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:8px; font-size:0.85rem;"
              :style="{
                background: m.completada ? '#22c55e22' : '#21262d',
                opacity: m.completada ? 1 : 0.5
              }"
            >
              <span style="font-size:1.2rem;">{{ m.icon }}</span>
              <span style="flex:1;" :style="{ color: m.completada ? '#22c55e' : '#8b949e' }">{{ m.label }}</span>
              <span style="font-size:0.75rem; font-weight:bold;" :style="{ color: m.completada ? '#22c55e' : '#8b949e' }">
                {{ m.completada ? `+${m.xp}XP` : '—' }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
