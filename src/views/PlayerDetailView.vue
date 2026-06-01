<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTorneoStore } from '../stores/torneoStore'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { calcularRating } from '../lib/playerStats'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const route = useRoute()
const router = useRouter()
const torneo = useTorneoStore()

const jugador = ref(null)
const equipos = ref([])
const fixture = ref([])
const resultados = ref([])
const allGoles = ref([])
const loading = ref(true)

const equipoJugador = computed(() => {
  if (!jugador.value?.equipos?.length) return null
  return equipos.value.find(e => jugador.value.equipos.includes(e.id))
})

const evolucionGoles = computed(() => {
  const golesPorPartido = []
  const fechas = []
  if (!resultados.value.length || !fixture.value.length) return { labels: [], datasets: [] }
  const matches = resultados.value
    .map(r => {
      const f = fixture.value.find(x => x.id === r.fixture_id)
      return { ...r, fecha: f?.fecha || '', hora: f?.hora || '' }
    })
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.hora || '').localeCompare(b.hora || ''))

  let total = 0
  for (const m of matches) {
    const golesMatch = allGoles.value.filter(g => g.resultado_id === m.id && g.jugador_id === jugador.value?.id)
    total += golesMatch.length
    golesPorPartido.push(total)
    fechas.push(m.fecha || `#${m.id}`)
  }
  return {
    labels: fechas,
    datasets: [{
      label: 'Goles Acumulados',
      data: golesPorPartido,
      borderColor: '#eab308',
      backgroundColor: 'rgba(234, 179, 8, 0.1)',
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#eab308',
      pointRadius: 4
    }]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#ffffff' } } },
  scales: {
    y: { ticks: { color: '#ffffff' }, grid: { color: '#30363d' } },
    x: { ticks: { color: '#ffffff' }, grid: { color: '#30363d' } }
  }
}

  async function loadData() {
  if (!torneo.torneoActual || !route.params.id) { loading.value = false; return }
  loading.value = true
  try {
    const [jg, eq, fx, rs] = await Promise.all([
      db.getJugadores(torneo.torneoActual),
      db.getEquipos(torneo.torneoActual),
      db.getFixture(torneo.torneoActual),
      db.getResultados(torneo.torneoActual)
    ])
    equipos.value = eq
    fixture.value = fx
    resultados.value = rs
    jugador.value = jg.find(j => j.id === parseInt(route.params.id)) || null

    if (resultados.value.length) {
      const resIds = resultados.value.map(r => r.id)
      const { data: goles } = await supabase.from('goles').select('*').in('resultado_id', resIds)
      allGoles.value = goles || []
    }
  } finally { loading.value = false }
}

watch(() => [torneo.torneoActual, route.params.id], async () => { if (torneo.torneoActual && route.params.id) await loadData() })
onMounted(async () => { if (torneo.torneoActual && route.params.id) await loadData() })
</script>

<template>
  <section>
    <div v-if="loading" class="box" style="text-align:center; color:var(--text-accent);">Cargando...</div>

    <div v-else-if="!jugador" class="box" style="text-align:center; color:#ef4444; padding:30px;">Jugador no encontrado</div>

    <template v-else>
      <button @click="router.back()" class="btn-mini" style="background:var(--btn-bg); color:var(--text); margin-bottom:10px;">← Volver</button>

      <div class="box">
        <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
          <div style="width:80px; height:80px; border-radius:50%; overflow:hidden; border:2px solid #eab308; flex-shrink:0;">
            <img :src="jugador.foto || ''" loading="lazy" style="width:100%; height:100%; object-fit:cover;" alt="" @error="$event.target.style.display='none'">
          </div>
          <div style="flex:1;">
            <h2 style="color:#eab308; margin:0;">{{ jugador.nombre }}</h2>
            <p style="color:var(--text-muted); margin:4px 0 0;">
              {{ jugador.posicion === 'POR' ? '🧤 Portero' : '⚽ Jugador de campo' }}
              <span v-if="equipoJugador" style="margin-left:10px;">| {{ equipoJugador.nombre }}</span>
            </p>
          </div>
          <div style="text-align:center;">
            <div style="font-size:2.5rem; font-weight:700; color:#eab308;">{{ calcularRating(jugador) }}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Rating</div>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom:15px;">
        <div class="box" style="text-align:center; padding:15px;">
          <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ jugador.goles || 0 }}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">⚽ Goles</div>
        </div>
        <div class="box" style="text-align:center; padding:15px;">
          <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ jugador.pj || 0 }}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">🏃 Partidos</div>
        </div>
        <div class="box" style="text-align:center; padding:15px;">
          <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ jugador.mvps || 0 }}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">⭐ MVP</div>
        </div>
        <div class="box" style="text-align:center; padding:15px;">
          <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ jugador.amarillas || 0 }}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">🟨 Amarillas</div>
        </div>
        <div class="box" style="text-align:center; padding:15px;">
          <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ jugador.rojas || 0 }}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">🟥 Rojas</div>
        </div>
        <div class="box" style="text-align:center; padding:15px;">
          <div style="font-size:1.5rem; font-weight:bold; color:#eab308;">{{ jugador.vallas_invictas || 0 }}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">🧤 Vallas Inv.</div>
        </div>
      </div>

      <div class="box">
        <h4 style="color:#eab308; margin-bottom:15px;">📈 Evolución de Goles</h4>
        <div style="height:250px;">
          <Line v-if="evolucionGoles.labels.length" :data="evolucionGoles" :options="chartOptions" />
          <p v-else style="color:var(--text-muted); text-align:center;">Sin datos de evolución</p>
        </div>
      </div>

      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">⚽ Detalle de Goles</h4>
        <div v-if="allGoles.filter(g => g.jugador_id === jugador.id).length === 0" style="color:var(--text-muted);">Sin goles registrados</div>
        <div class="overflow-table" v-else>
          <table>
            <thead>
              <tr><th>#</th><th>Resultado ID</th><th>Minuto</th></tr>
            </thead>
            <tbody>
              <tr v-for="(g, i) in allGoles.filter(g => g.jugador_id === jugador.id)" :key="g.id" style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;">{{ i + 1 }}</td>
                <td style="padding:8px;">{{ g.resultado_id }}</td>
                <td style="padding:8px;">{{ g.minuto }}'</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>
