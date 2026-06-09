<script setup>
import { ref, computed, watch } from 'vue'
import { useTorneoStore } from '../stores/torneoStore'
import { useAuthStore } from '../stores/authStore'
import { db } from '../lib/db'

const torneo = useTorneoStore()
const auth = useAuthStore()

const dia = ref('')
const equipos = ref([])
const loading = ref(false)
const selectedEquipo = ref(null)
const selectedEquipoJugadores = ref([])

const equiposFiltrados = computed(() => {
  if (!dia.value) return []
  return equipos.value
    .filter(e => e.dia_semana === dia.value)
    .sort((a, b) => (b.pts || 0) - (a.pts || 0) || ((b.gf || 0) - (b.gc || 0)) - ((a.gf || 0) - (a.gc || 0)))
})

async function loadData() {
  if (!torneo.torneoActual) return
  loading.value = true
  try {
    equipos.value = await db.getEquipos(torneo.torneoActual)
  } finally {
    loading.value = false
  }
}

watch(() => torneo.torneoActual, async () => {
  dia.value = ''
  equipos.value = []
  if (torneo.torneoActual) await loadData()
})

watch(dia, async () => {
  if (dia.value && equipos.value.length === 0 && torneo.torneoActual) {
    await loadData()
  }
})

async function mostrarDetalleEquipo(equipoId) {
  const jugadores = await db.getJugadores(torneo.torneoActual)
  const eq = equipos.value.find(e => e.id === equipoId)
  if (!eq) return
  selectedEquipo.value = eq
  selectedEquipoJugadores.value = jugadores.filter(j => j.equipos?.includes(eq.id))
}

function cerrarDetalle() {
  selectedEquipo.value = null
  selectedEquipoJugadores.value = []
}

function dif(eq) {
  return (eq.gf || 0) - (eq.gc || 0)
}
</script>

<template>
  <section>
    <div class="box">
      <select v-model="dia">
        <option disabled value="">Elegir Día para Tabla</option>
        <option>Lunes</option>
        <option value="Miercoles">Miércoles</option>
        <option>Jueves</option>
        <option>Viernes</option>
        <option value="Sabado">Sábado</option>
        <option>Domingo</option>
      </select>
    </div>

    <div v-if="!dia" class="box" style="text-align:center; color:var(--text-muted);">
      Seleccioná un día para ver la tabla de posiciones
    </div>

    <div v-else-if="loading" class="box" style="text-align:center; color:var(--text-accent);">
      <div class="spinner-ring"></div><span>Cargando...</span>
    </div>

    <div v-else-if="equiposFiltrados.length === 0" class="box" style="text-align:center; color:#f97316;">
      No hay equipos registrados para este día
    </div>

    <div v-else class="box overflow-table">
      <table>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Equipo</th>
            <th>PJ</th>
            <th>V</th>
            <th>E</th>
            <th>P</th>
            <th>GF</th>
            <th>GC</th>
            <th>DF</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in equiposFiltrados" :key="e.id">
            <td>{{ i + 1 }}</td>
            <td style="text-align:left;">
              <img
                v-if="e.logo"
                :src="e.logo"
                loading="lazy"
                class="mini-logo-table"
                style="width:28px;height:28px;border-radius:50%;margin-right:8px;"
                @error="$event.target.style.display='none'"
              />
              <a
                href="#"
                @click.prevent="mostrarDetalleEquipo(e.id)"
                style="color:white; text-decoration:none; font-weight:600;"
                @mouseover="$event.target.style.color='#eab308'"
                @mouseout="$event.target.style.color='white'"
              >
                {{ e.nombre }}
              </a>
            </td>
            <td>{{ e.pj || 0 }}</td>
            <td>{{ e.v || 0 }}</td>
            <td>{{ e.e || 0 }}</td>
            <td>{{ e.p || 0 }}</td>
            <td>{{ e.gf || 0 }}</td>
            <td>{{ e.gc || 0 }}</td>
            <td :style="{ color: dif(e) >= 0 ? '#22c55e' : '#ef4444' }">
              {{ dif(e) }}
            </td>
            <td><b>{{ e.pts || 0 }}</b></td>
          </tr>
        </tbody>
      </table>
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
          <div style="display:flex; justify-content:center; gap:20px; margin:10px 0; color:var(--text-accent); font-size:0.9rem;">
            <span>PJ: <b style="color:white;">{{ selectedEquipo.pj || 0 }}</b></span>
            <span>V: <b style="color:#22c55e;">{{ selectedEquipo.v || 0 }}</b></span>
            <span>E: <b style="color:#eab308;">{{ selectedEquipo.e || 0 }}</b></span>
            <span>P: <b style="color:#ef4444;">{{ selectedEquipo.p || 0 }}</b></span>
            <span>PTS: <b style="color:#3b82f6;">{{ selectedEquipo.pts || 0 }}</b></span>
          </div>
          <div style="display:flex; justify-content:center; gap:20px; color:var(--text-accent); font-size:0.9rem;">
            <span>GF: <b style="color:white;">{{ selectedEquipo.gf || 0 }}</b></span>
            <span>GC: <b style="color:white;">{{ selectedEquipo.gc || 0 }}</b></span>
            <span>DF: <b :style="{ color: dif(selectedEquipo) >= 0 ? '#22c55e' : '#ef4444' }">{{ dif(selectedEquipo) }}</b></span>
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
            :src="j.foto || ''"
            loading="lazy"
            style="width:32px;height:32px;border-radius:50%;object-fit:cover;background:var(--border);"
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
