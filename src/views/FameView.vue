<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTorneoStore } from '../stores/torneoStore'
import { db } from '../lib/db'
import { calcularXP, calcularNivel, xpParaSiguienteNivel, getNivelColor, getNivelLabel, calcularRating } from '../lib/playerStats'

const torneo = useTorneoStore()

const jugadores = ref([])
const equipos = ref([])
const loading = ref(false)
const selectedPlayer = ref(null)

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%2330363d' width='150' height='150'/%3E%3Ctext fill='%238b949e' font-family='sans-serif' font-size='14' text-anchor='middle' x='75' y='85'%3ESin Foto%3C/text%3E%3C/svg%3E"

const cracks = computed(() => {
  return [...jugadores.value]
    .sort((a, b) => (b.mvps || 0) - (a.mvps || 0) || (b.goles || 0) - (a.goles || 0))
    .slice(0, 12)
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

function getTierClass(nivel, esCampeon) {
  if (esCampeon) return 'fifa-champion'
  if (nivel >= 12) return 'fifa-diamond'
  if (nivel >= 9) return 'fifa-gold'
  if (nivel >= 6) return 'fifa-silver'
  if (nivel >= 3) return 'fifa-bronze'
  return ''
}

function getTierColor(nivel, esCampeon) {
  if (esCampeon) return '#eab308'
  if (nivel >= 12) return '#8b5cf6'
  if (nivel >= 9) return '#eab308'
  if (nivel >= 6) return '#94a3b8'
  if (nivel >= 3) return '#cd7f32'
  return '#4a5568'
}

function barColor(val) {
  if (val >= 85) return '#22c55e'
  if (val >= 70) return '#eab308'
  if (val >= 50) return '#f97316'
  return '#ef4444'
}

function calcularAtributos(j) {
  if (!j.pj) return { fin: 0, est: 0, def: 0, res: 0 }
  const gpp = (j.goles || 0) / j.pj
  const mvpRatio = (j.mvps || 0) / j.pj
  return {
    fin: Math.min(99, Math.round(gpp * 25 + (j.goles || 0) * 0.3 + 30)),
    est: Math.min(99, Math.round(mvpRatio * 40 + (j.mvps || 0) * 0.5 + 20)),
    def: Math.min(99, Math.round((j.vallas_invictas || 0) * 8 + (j.posicion === 'POR' || j.posicion === 'DFC' ? 25 : 0) + 30)),
    res: Math.min(99, Math.round(j.pj * 1.5 + 30))
  }
}

function posMap(p) {
  const map = { POR: 'Portero', DFC: 'Defensa', MC: 'Mediocampista', DEL: 'Delantero' }
  return map[p] || p
}

function pieMap(p) {
  return p === 'R' ? 'Diestro' : p === 'L' ? 'Zurdo' : p
}

function getPlayerEquipos(j) {
  return (j.equipos || []).map(eId => equipos.value.find(e => e.id === eId)).filter(Boolean)
}

function openPlayerDetail(j) {
  selectedPlayer.value = j
}

function closePlayerDetail() {
  selectedPlayer.value = null
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
    <div v-if="loading" class="box spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
    <div v-else-if="cracks.length === 0" class="box" style="text-align:center; color:#8b949e;">
      No hay jugadores en este torneo
    </div>
    <div v-else class="box">
      <h3>🏆 SALÓN DE LA FAMA</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:20px; margin-top:15px;">
        <div
          v-for="j in cracks"
          :key="j.id"
          class="fifa-card"
          :class="getTierClass(
            calcularNivel(calcularXP(j)),
            championTeams.length > 0 && (j.equipos || []).some(eId => championTeams.includes(eId))
          )"
          @click="openPlayerDetail(j)"
        >
          <div class="fifa-rating">{{ calcularRating(j) }}</div>
          <div class="fifa-pos-badge">{{ j.posicion }}</div>
          <span
            v-if="championTeams.length > 0 && (j.equipos || []).some(eId => championTeams.includes(eId))"
            class="fifa-crown"
          >👑</span>

          <div
            class="fifa-photo-wrap"
            :style="{
              borderColor: getTierColor(calcularNivel(calcularXP(j)), championTeams.length > 0 && (j.equipos || []).some(eId => championTeams.includes(eId))),
              boxShadow: '0 0 14px ' + getTierColor(calcularNivel(calcularXP(j)), championTeams.length > 0 && (j.equipos || []).some(eId => championTeams.includes(eId))) + '50'
            }"
          >
            <img :src="j.foto || DEFAULT_AVATAR" loading="lazy">
          </div>

          <div
            class="fifa-level-badge"
            :style="{ background: getNivelColor(calcularNivel(calcularXP(j))) }"
          >
            {{ getNivelLabel(calcularNivel(calcularXP(j))) }} · Lv.{{ calcularNivel(calcularXP(j)) }}
          </div>

          <div class="fifa-name">{{ j.nombre }}</div>

          <div class="fifa-stats">
            <div class="fifa-stat">
              <span class="s-label">⚽ FIN</span>
              <div class="s-track"><div class="s-fill" :style="{ width: calcularAtributos(j).fin + '%', background: barColor(calcularAtributos(j).fin) }"></div></div>
              <span class="s-val">{{ calcularAtributos(j).fin }}</span>
            </div>
            <div class="fifa-stat">
              <span class="s-label">⭐ EST</span>
              <div class="s-track"><div class="s-fill" :style="{ width: calcularAtributos(j).est + '%', background: barColor(calcularAtributos(j).est) }"></div></div>
              <span class="s-val">{{ calcularAtributos(j).est }}</span>
            </div>
            <div class="fifa-stat">
              <span class="s-label">🛡️ DEF</span>
              <div class="s-track"><div class="s-fill" :style="{ width: calcularAtributos(j).def + '%', background: barColor(calcularAtributos(j).def) }"></div></div>
              <span class="s-val">{{ calcularAtributos(j).def }}</span>
            </div>
            <div class="fifa-stat">
              <span class="s-label">🏃 RES</span>
              <div class="s-track"><div class="s-fill" :style="{ width: calcularAtributos(j).res + '%', background: barColor(calcularAtributos(j).res) }"></div></div>
              <span class="s-val">{{ calcularAtributos(j).res }}</span>
            </div>
          </div>

          <div class="fifa-real-stats">
            ⚽ <span class="rs-val">{{ j.goles || 0 }}</span>
            ⭐ <span class="rs-val">{{ j.mvps || 0 }}</span>
            🏃 <span class="rs-val">{{ j.pj || 0 }}</span>
          </div>

          <img
            v-if="logoEq(j)"
            :src="logoEq(j)"
            loading="lazy"
            class="fifa-team-logo"
            @error="$event.target.style.display='none'"
          >
        </div>
      </div>
    </div>

    <!-- Player Detail Overlay -->
    <div
      v-if="selectedPlayer"
      style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:1000;"
      @click.self="closePlayerDetail"
    >
      <div style="background:var(--bg-card); border:2px solid #eab308; border-radius:16px; padding:30px; max-width:520px; width:90%; max-height:90vh; overflow-y:auto; position:relative;">
        <button @click="closePlayerDetail" style="position:absolute;top:10px;right:10px;background:#ef4444;color:white;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1.2rem;">✕</button>

        <div style="text-align:center; margin-bottom:20px;">
          <div style="display:inline-block; position:relative;">
            <img :src="selectedPlayer.foto || DEFAULT_AVATAR" loading="lazy" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #eab308;margin-bottom:10px;">
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
              style="display:flex; align-items:center; gap:5px; background:var(--bg-input); padding:4px 12px; border-radius:20px; border:1px solid #30363d;"
            >
              <img v-if="eq.logo" :src="eq.logo" loading="lazy" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">
              <span style="font-size:0.8rem; color:#b0bcc4;">{{ eq.nombre }}</span>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:10px;">
          <div style="background:var(--bg-input); border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#22c55e;">{{ selectedPlayer.goles || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">GOLES</div>
          </div>
          <div style="background:var(--bg-input); border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#3b82f6;">{{ selectedPlayer.pj || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">PARTIDOS</div>
          </div>
          <div style="background:var(--bg-input); border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ calcularRating(selectedPlayer) }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">RATING</div>
          </div>
          <div style="background:var(--bg-input); border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#f97316;">{{ selectedPlayer.mvps || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">MVP</div>
          </div>
          <div style="background:var(--bg-input); border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ selectedPlayer.amarillas || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">AMARILLAS</div>
          </div>
          <div style="background:var(--bg-input); border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:1.5rem; font-weight:bold; color:#ef4444;">{{ selectedPlayer.rojas || 0 }}</div>
            <div style="font-size:0.7rem; color:#8b949e;">ROJAS</div>
          </div>
        </div>

        <div v-if="selectedPlayer" style="background:var(--bg-input); border-radius:8px; padding:15px; margin-bottom:10px; text-align:center;">
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

        <div style="background:var(--bg-input); border-radius:8px; padding:15px;">
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
