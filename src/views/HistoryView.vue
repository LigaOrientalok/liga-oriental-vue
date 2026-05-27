<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTorneoStore } from '../stores/torneoStore'
import { db } from '../lib/db'

const router = useRouter()
const torneo = useTorneoStore()

const historial = ref([])
const loading = ref(false)

async function loadHistorial() {
  loading.value = true
  try {
    const torneos = await db.getTorneos()
    if (torneos.length === 0) {
      historial.value = []
      return
    }

    const data = await Promise.all(torneos.slice().reverse().map(async (t) => {
      const [equipos, jugadores] = await Promise.all([
        db.getEquipos(t.id),
        db.getJugadores(t.id)
      ])

      let champion = null
      if (equipos.length > 0) {
        const sorted = [...equipos].sort((a, b) => (b.pts || 0) - (a.pts || 0) || ((b.gf || 0) - (b.gc || 0)) - ((a.gf || 0) - (a.gc || 0)))
        if (sorted[0]?.pj > 0) champion = sorted[0]
      }

      const topScorer = [...jugadores].sort((a, b) => (b.goles || 0) - (a.goles || 0))[0]
      const topMvp = [...jugadores].sort((a, b) => (b.mvps || 0) - (a.mvps || 0))[0]

      return {
        ...t,
        equiposCount: equipos.length,
        jugadoresCount: jugadores.length,
        champion: champion ? { nombre: champion.nombre, logo: champion.logo, pts: champion.pts } : null,
        topScorer: topScorer ? { nombre: topScorer.nombre, goles: topScorer.goles } : null,
        topMvp: topMvp ? { nombre: topMvp.nombre, mvps: topMvp.mvps } : null
      }
    }))
    historial.value = data
  } finally {
    loading.value = false
  }
}

async function cargarTorneoHistorial(torneoId) {
  await torneo.selectTorneo(torneoId)
  router.push('/tablas')
}

onMounted(async () => {
  await loadHistorial()
})
</script>

<template>
  <section>
    <div v-if="loading" class="box" style="text-align:center; color:#b0bcc4; padding:40px;">Cargando historial...</div>
    <div v-else-if="historial.length === 0" class="box" style="text-align:center; color:#8b949e; padding:40px;">
      No hay torneos registrados
    </div>
    <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:15px;">
      <div
        v-for="t in historial"
        :key="t.id"
        style="background:#0d1117; border-radius:10px; padding:20px; border:1px solid #30363d; border-left:4px solid #eab308;"
      >
        <div style="margin-bottom:12px;">
          <h3 style="color:#eab308; margin:0; font-size:1rem;">{{ t.nombre }}</h3>
          <p v-if="t.descripcion" style="color:#8b949e; margin:4px 0 0; font-size:0.8rem;">{{ t.descripcion }}</p>
        </div>
        <div style="display:grid; gap:6px; font-size:0.85rem;">
          <div style="display:flex; justify-content:space-between; padding:4px 0;">
            <span style="color:#8b949e;">📋 Equipos</span>
            <span style="color:white; font-weight:bold;">{{ t.equiposCount }}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;">
            <span style="color:#8b949e;">👤 Jugadores</span>
            <span style="color:white; font-weight:bold;">{{ t.jugadoresCount }}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;">
            <span style="color:#8b949e;">🏆 Campeón</span>
            <span v-if="t.champion" style="color:#eab308; font-weight:bold;">
              <img v-if="t.champion.logo" :src="t.champion.logo" style="width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:4px;" @error="$event.target.style.display='none'">
              {{ t.champion.nombre }} ({{ t.champion.pts }} pts)
            </span>
            <span v-else style="color:#8b949e;">—</span>
          </div>
          <div v-if="t.topScorer && t.topScorer.goles > 0" style="display:flex; justify-content:space-between; padding:4px 0;">
            <span style="color:#8b949e;">⚽ Goleador</span>
            <span style="color:#22c55e; font-weight:bold;">{{ t.topScorer.nombre }} ({{ t.topScorer.goles }})</span>
          </div>
          <div v-if="t.topMvp && t.topMvp.mvps > 0" style="display:flex; justify-content:space-between; padding:4px 0;">
            <span style="color:#8b949e;">⭐ MVP</span>
            <span style="color:#f97316; font-weight:bold;">{{ t.topMvp.nombre }} ({{ t.topMvp.mvps }})</span>
          </div>
        </div>
        <button @click="cargarTorneoHistorial(t.id)" class="btn-mini" style="background:#3b82f6; color:white; width:100%; margin-top:10px;">
          📂 Ver Torneo
        </button>
      </div>
    </div>
  </section>
</template>
