<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTorneoStore } from '../stores/torneoStore'
import { db } from '../lib/db'
import { calcularXP, calcularNivel, getNivelColor, calcularRating } from '../lib/playerStats'

const router = useRouter()
const torneo = useTorneoStore()

const jugadores = ref([])
const equipos = ref([])
const loading = ref(false)
const selectedPlayer = ref(null)

const search = ref('')
const posFilter = ref('')
const eqFilter = ref('')

const posMap = { POR: 'POR', DFC: 'DFC', MC: 'MC', DEL: 'DEL' }
const posColors = { POR: '#f97316', DFC: '#3b82f6', MC: '#22c55e', DEL: '#ef4444' }
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%2330363d' width='150' height='150'/%3E%3Ctext fill='%238b949e' font-family='sans-serif' font-size='14' text-anchor='middle' x='75' y='85'%3ESin Foto%3C/text%3E%3C/svg%3E"

const filteredJugadores = computed(() => {
  let result = jugadores.value
  const term = search.value.toLowerCase().trim()
  if (term) result = result.filter(j => j.nombre.toLowerCase().includes(term))
  if (posFilter.value) result = result.filter(j => j.posicion === posFilter.value)
  if (eqFilter.value) result = result.filter(j => j.equipos?.includes(parseInt(eqFilter.value)))
  return result
})

function getTierClass(nivel) {
  if (nivel >= 12) return 'fifa-gold'
  if (nivel >= 9) return 'fifa-gold'
  if (nivel >= 6) return 'fifa-silver'
  if (nivel >= 3) return 'fifa-bronze'
  return ''
}

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

function mostrarDetalleJugador(j) {
  selectedPlayer.value = j
}

function cerrarDetalle() {
  selectedPlayer.value = null
}

function irAPerfil() {
  if (selectedPlayer.value) {
    const id = selectedPlayer.value.id
    cerrarDetalle()
    router.push(`/jugador/${id}`)
  }
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
    <div class="box">
      <h3>🔍 Buscador de Jugadores</h3>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
        <input
          v-model="search"
          type="text"
          placeholder="Buscar por nombre..."
          style="flex:1; min-width:200px; padding:10px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border); margin:0;"
        />
        <select v-model="posFilter" style="padding:10px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
          <option value="">Todas las posiciones</option>
          <option value="POR">Portero</option>
          <option value="DFC">Defensa</option>
          <option value="MC">Mediocampista</option>
          <option value="DEL">Delantero</option>
        </select>
        <select v-model="eqFilter" style="padding:10px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
          <option value="">Todos los equipos</option>
          <option v-for="eq in equipos" :key="eq.id" :value="eq.id">{{ eq.nombre }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="box spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
    <div v-else-if="filteredJugadores.length === 0" class="box" style="text-align:center; color:var(--text-muted); padding:40px;">
      No se encontraron jugadores
    </div>
    <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:10px;">
      <div
        v-for="j in filteredJugadores"
        :key="j.id"
        class="fifa-mini"
        :class="getTierClass(calcularNivel(calcularXP(j)))"
        @click="mostrarDetalleJugador(j)"
      >
        <div style="position:relative; flex-shrink:0;">
          <img
            :src="j.foto || DEFAULT_AVATAR"
            loading="lazy"
            class="mini-photo"
          />
          <span
            class="mini-level"
            :style="{ background: getNivelColor(calcularNivel(calcularXP(j))) }"
          >Lv.{{ calcularNivel(calcularXP(j)) }}</span>
        </div>
        <div class="mini-info">
          <div style="display:flex; align-items:center; gap:6px;">
            <div class="name" style="flex:1;">{{ j.nombre }}</div>
            <span
              style="padding:1px 8px; border-radius:4px; font-size:0.65rem; font-weight:600; color:white; flex-shrink:0;"
              :style="{ background: posColors[j.posicion] || 'var(--border)' }"
            >{{ posMap[j.posicion] || j.posicion }}</span>
          </div>
          <div class="mini-stats">
            <span style="color:#22c55e;">⚽ {{ j.goles || 0 }}</span>
            <span style="color:#f97316;">⭐ {{ j.mvps || 0 }}</span>
            <span style="color:#eab308;">📊 {{ calcularRating(j) }}</span>
          </div>
        </div>
        <img
          v-if="logoEq(j)"
          :src="logoEq(j)"
          loading="lazy"
          :title="nombreEq(j.equipos?.[0])"
          style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;position:relative;z-index:1;border:1px solid rgba(255,255,255,0.2);"
          @error="$event.target.style.display='none'"
        >
      </div>
    </div>

    <div
      v-if="selectedPlayer"
      style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:1000;"
      @click.self="cerrarDetalle"
    >
      <div style="background:var(--bg-card); border:2px solid #eab308; border-radius:16px; padding:24px; max-width:400px; width:90%; position:relative;">
        <button @click="cerrarDetalle" style="position:absolute;top:10px;right:10px;background:#ef4444;color:white;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1.2rem;">✕</button>
        <div style="text-align:center;">
          <div style="display:inline-block; position:relative;">
            <img :src="selectedPlayer.foto || DEFAULT_AVATAR" loading="lazy" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #eab308;margin-bottom:8px;">
            <span
              style="position:absolute;bottom:5px;right:-4px;color:black;padding:2px 8px;border-radius:10px;font-size:0.6rem;font-weight:bold;z-index:5;"
              :style="{ background: getNivelColor(calcularNivel(calcularXP(selectedPlayer))) }"
            >Lv.{{ calcularNivel(calcularXP(selectedPlayer)) }}</span>
          </div>
          <h3 style="color:#eab308; margin:5px 0;">{{ selectedPlayer.nombre }}</h3>
          <div style="display:flex; justify-content:center; gap:8px; margin:5px 0;">
            <span style="background:#3b82f6; padding:2px 10px; border-radius:4px; font-size:0.75rem;">{{ selectedPlayer.posicion || '-' }}</span>
            <span style="background:var(--border); padding:2px 10px; border-radius:4px; font-size:0.75rem;">{{ selectedPlayer.pierna === 'R' ? 'Diestro' : 'Zurdo' }}</span>
          </div>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:12px;">
            <div style="background:var(--bg-input); border-radius:6px; padding:8px; text-align:center;">
              <div style="font-size:1.2rem; font-weight:bold; color:#22c55e;">{{ selectedPlayer.goles || 0 }}</div>
              <div style="font-size:0.6rem; color:var(--text-muted);">GOLES</div>
            </div>
            <div style="background:var(--bg-input); border-radius:6px; padding:8px; text-align:center;">
              <div style="font-size:1.2rem; font-weight:bold; color:#3b82f6;">{{ selectedPlayer.pj || 0 }}</div>
              <div style="font-size:0.6rem; color:var(--text-muted);">PJ</div>
            </div>
            <div style="background:var(--bg-input); border-radius:6px; padding:8px; text-align:center;">
              <div style="font-size:1.2rem; font-weight:bold; color:#f97316;">{{ selectedPlayer.mvps || 0 }}</div>
              <div style="font-size:0.6rem; color:var(--text-muted);">MVP</div>
            </div>
          </div>
          <div style="margin-top:10px; font-size:1.3rem; font-weight:bold; color:#eab308;">
            {{ calcularRating(selectedPlayer) }}
          </div>
          <div style="margin-top:12px;">
            <button @click="irAPerfil" style="padding:8px 16px; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold; width:100%;">📊 Ver Perfil Completo</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
