<script setup>
import { ref, watch, onMounted } from 'vue'
import { useTorneoStore } from '../stores/torneoStore'
import { db } from '../lib/db'

const torneo = useTorneoStore()

const equipos = ref([])
const jugadores = ref([])
const loading = ref(false)
const selectedEquipo = ref(null)
const selectedEquipoJugadores = ref([])

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%2330363d' width='150' height='150'/%3E%3Ctext fill='%238b949e' font-family='sans-serif' font-size='14' text-anchor='middle' x='75' y='85'%3ESin Foto%3C/text%3E%3C/svg%3E"

function getJugadoresCount(equipoId) {
  return jugadores.value.filter(j => j.equipos?.includes(equipoId)).length
}

function mostrarDetalleEquipo(equipoId) {
  const eq = equipos.value.find(e => e.id === equipoId)
  if (!eq) return
  selectedEquipo.value = eq
  selectedEquipoJugadores.value = jugadores.value.filter(j => j.equipos?.includes(eq.id))
}

function cerrarDetalle() {
  selectedEquipo.value = null
  selectedEquipoJugadores.value = []
}

function dif(eq) {
  return (eq.gf || 0) - (eq.gc || 0)
}

async function loadData() {
  if (!torneo.torneoActual) return
  loading.value = true
  try {
    const [e, j] = await Promise.all([
      db.getEquipos(torneo.torneoActual),
      db.getJugadores(torneo.torneoActual)
    ])
    equipos.value = e
    jugadores.value = j
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
    <div v-else-if="equipos.length === 0" class="box" style="text-align:center; color:var(--text-muted); padding:40px;">
      No hay equipos en este torneo
    </div>
    <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:15px;">
      <div
        v-for="e in equipos"
        :key="e.id"
        @click="mostrarDetalleEquipo(e.id)"
        style="background:var(--bg-input); border-radius:10px; padding:18px; border:1px solid var(--border); cursor:pointer; transition:all 0.2s;"
        @mouseover="$event.currentTarget.style.borderColor='#eab308'"
        @mouseout="$event.currentTarget.style.borderColor='var(--border)'"
      >
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <img
            v-if="e.logo"
            :src="e.logo"
            loading="lazy"
            style="width:48px; height:48px; border-radius:50%; object-fit:cover; background:var(--border);"
            @error="$event.target.style.display='none'"
          />
          <div v-else style="width:48px;height:48px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:1.2rem;">⚽</div>
          <div>
            <div style="color:white; font-weight:600; font-size:1rem;">{{ e.nombre }}</div>
            <div style="color:var(--text-muted); font-size:0.8rem;">{{ e.dia_semana }} · {{ getJugadoresCount(e.id) }} jugadores</div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:6px; text-align:center;">
          <div><div style="font-size:1.1rem; font-weight:bold; color:#3b82f6;">{{ e.pts || 0 }}</div><div style="font-size:0.6rem; color:var(--text-muted);">PTS</div></div>
          <div><div style="font-size:1.1rem; font-weight:bold; color:white;">{{ e.pj || 0 }}</div><div style="font-size:0.6rem; color:var(--text-muted);">PJ</div></div>
          <div><div style="font-size:1.1rem; font-weight:bold; color:#22c55e;">{{ e.v || 0 }}</div><div style="font-size:0.6rem; color:var(--text-muted);">V</div></div>
          <div><div style="font-size:1.1rem; font-weight:bold; color:#eab308;">{{ e.e || 0 }}</div><div style="font-size:0.6rem; color:var(--text-muted);">E</div></div>
          <div><div style="font-size:1.1rem; font-weight:bold; color:#ef4444;">{{ e.p || 0 }}</div><div style="font-size:0.6rem; color:var(--text-muted);">P</div></div>
          <div>
            <div style="font-size:1.1rem; font-weight:bold;" :style="{ color: ((e.gf||0) - (e.gc||0)) >= 0 ? '#22c55e' : '#ef4444' }">
              {{ ((e.gf||0) - (e.gc||0)) >= 0 ? '+' : '' }}{{ (e.gf||0) - (e.gc||0) }}
            </div>
            <div style="font-size:0.6rem; color:var(--text-muted);">DF</div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="selectedEquipo"
      style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:1000;"
      @click.self="cerrarDetalle"
    >
      <div style="background:var(--bg-card); border:2px solid #eab308; border-radius:12px; padding:30px; max-width:500px; width:90%; max-height:80vh; overflow-y:auto; position:relative;">
        <button @click="cerrarDetalle" style="position:absolute;top:10px;right:10px;background:#ef4444;color:white;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1.2rem;">✕</button>
        <div style="text-align:center; margin-bottom:20px;">
          <img
            v-if="selectedEquipo.logo"
            :src="selectedEquipo.logo"
            loading="lazy"
            style="width:60px;height:60px;border-radius:50%;object-fit:cover;background:var(--border);margin-bottom:10px;"
            @error="$event.target.style.display='none'"
          >
          <h2 style="color:#eab308; margin:0;">{{ selectedEquipo.nombre }}</h2>
          <p style="color:var(--text-muted); margin:5px 0;">{{ selectedEquipo.dia_semana }}</p>
          <div style="display:flex; justify-content:center; gap:15px; margin:10px 0; color:var(--text-accent); font-size:0.9rem; flex-wrap:wrap;">
            <span>PJ: <b style="color:white;">{{ selectedEquipo.pj || 0 }}</b></span>
            <span>V: <b style="color:#22c55e;">{{ selectedEquipo.v || 0 }}</b></span>
            <span>E: <b style="color:#eab308;">{{ selectedEquipo.e || 0 }}</b></span>
            <span>P: <b style="color:#ef4444;">{{ selectedEquipo.p || 0 }}</b></span>
            <span>PTS: <b style="color:#3b82f6;">{{ selectedEquipo.pts || 0 }}</b></span>
          </div>
          <div style="display:flex; justify-content:center; gap:15px; color:var(--text-accent); font-size:0.9rem;">
            <span>GF: <b style="color:white;">{{ selectedEquipo.gf || 0 }}</b></span>
            <span>GC: <b style="color:white;">{{ selectedEquipo.gc || 0 }}</b></span>
            <span>DF: <b :style="{ color: dif(selectedEquipo) >= 0 ? '#22c55e' : '#ef4444' }">{{ dif(selectedEquipo) >= 0 ? '+' : '' }}{{ dif(selectedEquipo) }}</b></span>
            <span>🚫 VI: <b style="color:white;">{{ selectedEquipo.vallas_invictas || 0 }}</b></span>
          </div>
        </div>
        <h3 style="color:#eab308; margin-bottom:10px;">Jugadores ({{ selectedEquipoJugadores.length }})</h3>
        <p v-if="selectedEquipoJugadores.length === 0" style="color:var(--text-muted);">Sin jugadores</p>
        <div
          v-for="j in selectedEquipoJugadores"
          :key="j.id"
          style="display:flex; align-items:center; gap:10px; padding:8px; background:var(--bg-input); border-radius:6px; margin-bottom:5px;"
        >
          <img
            :src="j.foto || DEFAULT_AVATAR"
            loading="lazy"
            style="width:32px;height:32px;border-radius:50%;object-fit:cover;"
            @error="$event.target.style.display='none'"
          >
          <div style="flex:1;">
            <strong style="color:white;font-size:0.9rem;">{{ j.nombre }}</strong>
            <span style="color:var(--text-muted);font-size:0.75rem;margin-left:8px;">{{ j.posicion || '' }}</span>
          </div>
          <span style="color:var(--text-accent);font-size:0.8rem;">⚽ {{ j.goles || 0 }}</span>
          <span style="color:var(--text-accent);font-size:0.8rem;">⭐ {{ j.mvps || 0 }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
