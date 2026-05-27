<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { useTorneoStore } from '../stores/torneoStore'
import { db } from '../lib/db'
import { calcularRating } from '../lib/playerStats'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const torneo = useTorneoStore()

const dia = ref('')
const jugadores = ref([])
const equipos = ref([])
const loading = ref(false)

const jugadoresDia = computed(() => {
  if (!dia.value) return jugadores.value
  const eqs = equipos.value.filter(e => e.dia_semana === dia.value).map(e => e.id)
  return jugadores.value.filter(j => j.equipos?.some(eId => eqs.includes(eId)))
})

const equiposDia = computed(() => {
  if (!dia.value) return equipos.value
  return equipos.value.filter(e => e.dia_semana === dia.value)
})

const topGoleadores = computed(() => {
  return [...jugadoresDia.value].sort((a, b) => (b.goles || 0) - (a.goles || 0)).slice(0, 10)
})

const equiposOrdenados = computed(() => {
  return [...equiposDia.value].sort((a, b) => (b.pts || 0) - (a.pts || 0))
})

const chartColors = ['#eab308', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#14b8a6', '#f472b6', '#8b5cf6', '#84cc16', '#06b6d4', '#d946ef', '#0ea5e9', '#10b981']

const goleadoresChartData = computed(() => ({
  labels: topGoleadores.value.map(j => j.nombre),
  datasets: [{
    label: 'Goles',
    data: topGoleadores.value.map(j => j.goles || 0),
    backgroundColor: '#eab308',
    borderColor: '#b8860b',
    borderWidth: 2
  }]
}))

const goleadoresChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { labels: { color: '#ffffff' } } },
  scales: {
    y: { ticks: { color: '#ffffff' }, grid: { color: '#30363d' } },
    x: { ticks: { color: '#ffffff' }, grid: { color: '#30363d' } }
  }
}

const equiposChartData = computed(() => ({
  labels: equiposOrdenados.value.map(e => e.nombre),
  datasets: [{
    data: equiposOrdenados.value.map(e => e.pts || 0),
    backgroundColor: chartColors.slice(0, equiposOrdenados.value.length),
    borderColor: '#161b22',
    borderWidth: 2
  }]
}))

const equiposChartOptions = {
  responsive: true,
  plugins: { legend: { labels: { color: '#ffffff' } } }
}

const evolucionChartData = computed(() => ({
  labels: equiposDia.value.map(e => e.nombre),
  datasets: [{
    label: 'Puntos',
    data: equiposDia.value.map(e => e.pts || 0),
    borderColor: '#eab308',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 3,
    fill: true,
    tension: 0.4
  }, {
    label: 'Goles a Favor',
    data: equiposDia.value.map(e => e.gf || 0),
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 2,
    fill: true,
    tension: 0.4
  }, {
    label: 'Goles en Contra',
    data: equiposDia.value.map(e => e.gc || 0),
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 2,
    fill: true,
    tension: 0.4
  }]
}))

const evolucionChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { labels: { color: '#ffffff' } } },
  scales: {
    y: { ticks: { color: '#ffffff' }, grid: { color: '#30363d' } },
    x: { ticks: { color: '#ffffff' }, grid: { color: '#30363d' } }
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
  if (torneo.torneoActual) try { await loadData() } catch (e) { console.error(e) }
})

onMounted(async () => {
  if (torneo.torneoActual) try { await loadData() } catch (e) { console.error(e) }
})
</script>

<template>
  <section>
    <div class="box">
      <select v-model="dia">
        <option value="">Todos los días</option>
        <option>Lunes</option>
        <option value="Miercoles">Miércoles</option>
        <option>Jueves</option>
        <option>Viernes</option>
        <option value="Sabado">Sábado</option>
        <option>Domingo</option>
      </select>
    </div>

    <div v-if="loading" class="box" style="text-align:center; color:var(--text-accent);">Cargando...</div>

    <template v-else>
      <div class="box">
        <h3>📊 Estadísticas</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px;">
          <div>
            <h4 style="color:#eab308;">Top Goleadores</h4>
            <Bar v-if="topGoleadores.length" :data="goleadoresChartData" :options="goleadoresChartOptions" style="max-height:300px;" />
            <p v-else style="color:var(--text-muted);">Sin datos</p>
          </div>
          <div>
            <h4 style="color:#eab308;">Ranking Equipos</h4>
            <Doughnut v-if="equiposOrdenados.length" :data="equiposChartData" :options="equiposChartOptions" style="max-height:300px;" />
            <p v-else style="color:var(--text-muted);">Sin datos</p>
          </div>
          <div style="grid-column:1/-1;">
            <h4 style="color:#eab308;">Evolución</h4>
            <Line v-if="equiposDia.length" :data="evolucionChartData" :options="evolucionChartOptions" style="max-height:250px;" />
            <p v-else style="color:var(--text-muted);">Sin datos</p>
          </div>
        </div>
      </div>

      <div class="box">
        <h4 style="color:#eab308;">Tabla de Goleadores</h4>
        <div v-if="jugadoresDia.length === 0" style="color:var(--text-muted);">Sin jugadores</div>
        <div v-else class="overflow-table">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:var(--border);">
                <th style="padding:10px; text-align:left; color:#eab308;">Jugador</th>
                <th style="padding:10px; text-align:center; color:#eab308;">⚽ Goles</th>
                <th style="padding:10px; text-align:center; color:#eab308;">🏃 PJ</th>
                <th style="padding:10px; text-align:center; color:#eab308;">⭐ MVP</th>
                <th style="padding:10px; text-align:center; color:#eab308;">🟨 Amarillas</th>
                <th style="padding:10px; text-align:center; color:#eab308;">🟥 Rojas</th>
                <th style="padding:10px; text-align:center; color:#eab308;">Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(j, i) in jugadoresDia" :key="j.id" style="border-bottom:1px solid var(--border);" :style="i % 2 ? 'background:rgba(0,0,0,0.2);' : ''">
                <td style="padding:10px;">{{ j.nombre }}</td>
                <td style="padding:10px; text-align:center;">{{ j.goles || 0 }}</td>
                <td style="padding:10px; text-align:center;">{{ j.pj || 0 }}</td>
                <td style="padding:10px; text-align:center;">{{ j.mvps || 0 }}</td>
                <td style="padding:10px; text-align:center;">{{ j.amarillas || 0 }}</td>
                <td style="padding:10px; text-align:center;">{{ j.rojas || 0 }}</td>
                <td style="padding:10px; text-align:center; font-weight:bold; color:#eab308;">{{ calcularRating(j) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>
