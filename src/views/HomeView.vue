<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTorneoStore } from '../stores/torneoStore'
import { db } from '../lib/db'

const router = useRouter()
const torneo = useTorneoStore()

const equipos = ref([])
const jugadores = ref([])
const fixture = ref([])
const resultados = ref([])
const loading = ref(true)

const topGoleadores = computed(() => {
  return [...jugadores.value].sort((a, b) => (b.goles || 0) - (a.goles || 0)).slice(0, 5)
})

const equiposOrdenados = computed(() => {
  return [...equipos.value].sort((a, b) => (b.pts || 0) - (a.pts || 0))
})

const equipoMap = computed(() => {
  const m = {}
  for (const e of equipos.value) m[e.id] = e.nombre
  return m
})

const proximosPartidos = computed(() => {
  const pendientes = fixture.value.filter(f => !resultados.value.some(r => r.fixture_id === f.id))
  return pendientes.slice(0, 5).map(f => ({
    ...f,
    local_nombre: equipoMap.value[f.equipo_local_id] || 'Local',
    visit_nombre: equipoMap.value[f.equipo_visitante_id] || 'Visitante'
  }))
})

async function loadData() {
  if (!torneo.torneoActual) { loading.value = false; return }
  loading.value = true
  try {
    const [eq, jg, fx, rs] = await Promise.all([
      db.getEquipos(torneo.torneoActual),
      db.getJugadores(torneo.torneoActual),
      db.getFixture(torneo.torneoActual),
      db.getResultados(torneo.torneoActual)
    ])
    equipos.value = eq
    jugadores.value = jg
    fixture.value = fx
    resultados.value = rs
  } finally { loading.value = false }
}

watch(() => torneo.torneoActual, async () => { if (torneo.torneoActual) try { await loadData() } catch (e) { console.error(e) } })
onMounted(async () => { if (torneo.torneoActual) try { await loadData() } catch (e) { console.error(e) } })
</script>

<template>
  <div v-if="loading" class="box" style="text-align:center; color:#b0bcc4;">Cargando...</div>

  <div v-else-if="!torneo.torneoActual" class="box" style="text-align:center; color:#8b949e; padding:40px;">
    <h2 style="color:#eab308; margin-bottom:10px;">Bienvenido a Liga Oriental</h2>
    <p>Seleccioná o creá un torneo para empezar</p>
  </div>

  <template v-else>
    <div class="box" style="padding:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <h2 style="color:#eab308; margin:0;">{{ torneo.torneoNombre }}</h2>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button @click="router.push('/tablas')" class="btn-mini" style="background:#eab308; color:black;">📊 Ver Tabla</button>
        <button @click="router.push('/fixture')" class="btn-mini" style="background:#3b82f6; color:white;">📅 Fixture</button>
        <button @click="router.push('/stats')" class="btn-mini" style="background:#a855f7; color:white;">📈 Stats</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">📊 Tabla de Posiciones</h4>
        <div v-if="equiposOrdenados.length === 0" style="color:#8b949e;">Sin equipos</div>
        <table v-else>
          <thead>
            <tr><th>#</th><th>Equipo</th><th>PJ</th><th>PTS</th></tr>
          </thead>
          <tbody>
            <tr v-for="(e, i) in equiposOrdenados.slice(0, 6)" :key="e.id" style="border-bottom:1px solid var(--border);" :style="i < 3 ? 'font-weight:bold;' : ''">
              <td style="padding:8px;">{{ i + 1 }}</td>
              <td style="padding:8px; text-align:left;">{{ e.nombre }}</td>
              <td style="padding:8px;">{{ e.pj || 0 }}</td>
              <td style="padding:8px; color:#eab308;">{{ e.pts || 0 }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="equiposOrdenados.length > 6" style="text-align:center; margin-top:8px;">
          <a href="#" @click.prevent="router.push('/tablas')" style="color:#3b82f6; font-size:0.85rem;">Ver tabla completa ({{ equiposOrdenados.length }} equipos)</a>
        </div>
      </div>

      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">⚽ Top Goleadores</h4>
        <div v-if="topGoleadores.length === 0" style="color:#8b949e;">Sin datos</div>
        <div v-else>
          <div v-for="(j, i) in topGoleadores" :key="j.id" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); cursor:pointer;" @click="router.push(`/jugador/${j.id}`)">
            <span><span style="color:var(--text-muted); margin-right:8px;">{{ i + 1 }}.</span> {{ j.nombre }}</span>
            <span style="color:#eab308; font-weight:bold;">{{ j.goles || 0 }} ⚽</span>
          </div>
        </div>
      </div>
    </div>

    <div class="box">
      <h4 style="color:#eab308; margin-bottom:10px;">📅 Próximos Partidos</h4>
      <div v-if="proximosPartidos.length === 0" style="color:#8b949e;">No hay partidos pendientes</div>
      <div v-for="f in proximosPartidos" :key="f.id" class="fixture-item pendiente" style="cursor:pointer;" @click="router.push('/fixture')">
        <div style="font-size:0.85rem;">
          <div style="font-weight:bold;">{{ f.local_nombre }} vs {{ f.visit_nombre }}</div>
          <div style="color:var(--text-muted); font-size:0.75rem;">{{ f.fecha }} {{ f.hora }}</div>
        </div>
        <span style="color:#eab308; font-weight:bold;">PENDIENTE</span>
      </div>
    </div>
  </template>
</template>
