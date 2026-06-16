<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTorneoStore } from '../stores/torneoStore'
import { useAuthStore } from '../stores/authStore'
import { db } from '../lib/db'

const router = useRouter()
const torneo = useTorneoStore()
const auth = useAuthStore()

const equipos = ref([])
const jugadores = ref([])
const fixture = ref([])
const resultados = ref([])
const loading = ref(true)

const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

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

const partidosPendientes = computed(() => {
  return fixture.value.filter(f => !resultados.value.some(r => r.fixture_id === f.id))
})

const proximosPartidos = computed(() => {
  return partidosPendientes.value.slice(0, 5).map(f => ({
    ...f,
    local_nombre: equipoMap.value[f.equipo_local_id] || 'Local',
    visit_nombre: equipoMap.value[f.equipo_visitante_id] || 'Visitante'
  }))
})

const diasConPartidos = computed(() => {
  const dias = new Set()
  partidosPendientes.value.forEach(f => {
    if (f.dia_semana) dias.add(f.dia_semana)
  })
  return [...dias].sort((a, b) => diasSemana.indexOf(a) - diasSemana.indexOf(b))
})

const partidosHoy = computed(() => {
  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long' })
  const diaCapitalized = hoy.charAt(0).toUpperCase() + hoy.slice(1).toLowerCase()
  return partidosPendientes.value.filter(f => f.dia_semana === diaCapitalized).map(f => ({
    ...f,
    local_nombre: equipoMap.value[f.equipo_local_id] || 'Local',
    visit_nombre: equipoMap.value[f.equipo_visitante_id] || 'Visitante'
  }))
})

const equipoStats = computed(() => {
  return equiposOrdenados.value.slice(0, 6)
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

watch(() => torneo.torneoActual, async () => { try { await loadData() } catch (e) { console.error(e) } })
onMounted(async () => { try { await loadData() } catch (e) { console.error(e) } })

const mediaItems = ref([])

async function cargarMedia() {
  try {
    mediaItems.value = await db.getMedia()
  } catch (e) { console.error(e) }
}

onMounted(() => { cargarMedia() })

</script>

<template>
  <div v-if="loading" class="box spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>

  <div v-else-if="!torneo.torneoActual" class="box" style="text-align:center; color:var(--text-muted); padding:40px;">
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

    <!-- Días con partidos -->
    <div v-if="diasConPartidos.length > 0" class="box" style="padding:12px;">
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <span style="color:var(--text-muted); font-size:0.85rem;">📅 Días de juego:</span>
        <span
          v-for="d in diasConPartidos"
          :key="d"
          style="background:rgba(234,179,8,0.15); color:#eab308; padding:4px 14px; border-radius:20px; font-size:0.8rem; font-weight:600; border:1px solid rgba(234,179,8,0.3);"
        >{{ d }}</span>
      </div>
    </div>

    <!-- Partidos de hoy -->
    <div v-if="partidosHoy.length > 0" class="box" style="border-left:4px solid #22c55e;">
      <h4 style="color:#22c55e; margin-bottom:10px;">🔴 Partidos de Hoy</h4>
      <div v-for="f in partidosHoy" :key="f.id" style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border); cursor:pointer;" @click="router.push('/fixture')">
        <div>
          <span style="font-weight:600;">{{ f.local_nombre }}</span>
          <span style="color:var(--text-muted); margin:0 10px;">vs</span>
          <span style="font-weight:600;">{{ f.visit_nombre }}</span>
        </div>
        <span style="color:var(--text-muted); font-size:0.85rem;">{{ f.hora }}</span>
      </div>
    </div>

    <div class="home-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">📊 Tabla de Posiciones</h4>
        <div v-if="equipoStats.length === 0" style="color:var(--text-muted);">Sin equipos</div>
        <table v-else>
          <thead>
            <tr><th>#</th><th>Equipo</th><th>PJ</th><th>PTS</th></tr>
          </thead>
          <tbody>
            <tr v-for="(e, i) in equipoStats" :key="e.id" :style="{ borderBottom: '1px solid var(--border)', fontWeight: i < 3 ? 'bold' : 'normal' }">
              <td style="padding:8px;">{{ i + 1 }}</td>
              <td style="padding:8px; text-align:left;">{{ e.nombre }}</td>
              <td style="padding:8px;">{{ e.pj || 0 }}</td>
              <td style="padding:8px; color:#eab308;">{{ e.pts || 0 }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="equipoStats.length > 6" style="text-align:center; margin-top:8px;">
          <a href="#" @click.prevent="router.push('/tablas')" style="color:#3b82f6; font-size:0.85rem;">Ver tabla completa ({{ equiposOrdenados.length }} equipos)</a>
        </div>
      </div>

      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">⚽ Top Goleadores</h4>
        <div v-if="topGoleadores.length === 0" style="color:var(--text-muted);">Sin datos</div>
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
      <div v-if="proximosPartidos.length === 0" style="color:var(--text-muted);">No hay partidos pendientes</div>
      <div v-for="f in proximosPartidos" :key="f.id" class="fixture-item pendiente" style="cursor:pointer;" @click="router.push('/fixture')">
        <div style="font-size:0.85rem;">
          <div style="font-weight:bold;">{{ f.local_nombre }} vs {{ f.visit_nombre }}</div>
          <div style="color:var(--text-muted); font-size:0.75rem;">{{ f.fecha }} {{ f.hora }}</div>
        </div>
        <span style="color:#eab308; font-weight:bold;">PENDIENTE</span>
      </div>
    </div>

    <!-- Galería de la Liga -->
    <div class="box" style="margin-top:15px;">
      <h4 style="color:#eab308; margin-bottom:15px;">📸 Galería de la Liga</h4>

      <div v-if="mediaItems.length === 0" style="color:var(--text-muted); text-align:center; padding:20px;">
        No hay contenido multimedia todavía
      </div>
      <div v-else style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
        <div v-for="m in mediaItems" :key="m.id" style="background:var(--bg-input); border-radius:8px; overflow:hidden; border:1px solid var(--border);">
          <template v-if="m.tipo === 'video'">
            <iframe :src="m.contenido" frameborder="0" allowfullscreen style="width:100%; aspect-ratio:16/9;"></iframe>
          </template>
          <img v-else :src="m.contenido" :alt="m.titulo" style="width:100%; aspect-ratio:16/9; object-fit:cover;" />
          <div style="padding:8px;">
            <strong style="color:white; font-size:0.85rem; display:block;">{{ m.titulo }}</strong>
            <span v-if="m.descripcion" style="color:var(--text-muted); font-size:0.75rem;">{{ m.descripcion }}</span>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
