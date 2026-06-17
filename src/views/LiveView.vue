<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../lib/supabase'
import { useTorneoStore } from '../stores/torneoStore'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import { db } from '../lib/db'

const torneo = useTorneoStore()
const auth = useAuthStore()
const toast = useToastStore()

const fixture = ref([])
const resultados = ref([])
const equipos = ref([])
const jugadores = ref([])
const goles = ref([])
const fixtureId = ref(null)
const loading = ref(true)
let pollTimer = null

const selectedFixture = computed(() => fixture.value.find(f => f.id === fixtureId.value))

const resultado = computed(() => {
  if (!selectedFixture.value) return null
  return resultados.value.find(r => r.fixture_id === selectedFixture.value.id)
})

const golesDelPartido = computed(() => {
  if (!resultado.value) return []
  return goles.value.filter(g => g.resultado_id === resultado.value.id)
})

const golesLocal = computed(() => golesDelPartido.value.filter(g => g.equipo_id === selectedFixture.value?.equipo_local_id))
const golesVisit = computed(() => golesDelPartido.value.filter(g => g.equipo_id === selectedFixture.value?.equipo_visitante_id))

function getJugador(id) { return jugadores.value.find(j => j.id === id) }
function getEq(id) { return equipos.value.find(e => e.id === id) }

// Add goal (admin/delegado)
const addGoalTeam = ref('local')
const addGoalJugador = ref(null)
const addGoalMinuto = ref('')
const addGoalSaving = ref(false)
const showAddGoal = ref(false)

const jugadoresLocal = computed(() => {
  if (!selectedFixture.value) return []
  return jugadores.value.filter(j => j.equipos?.includes(selectedFixture.value.equipo_local_id))
})
const jugadoresVisit = computed(() => {
  if (!selectedFixture.value) return []
  return jugadores.value.filter(j => j.equipos?.includes(selectedFixture.value.equipo_visitante_id))
})

async function addGoal() {
  if (!resultado.value || !addGoalJugador.value || !addGoalMinuto.value) return
  addGoalSaving.value = true
  const equipoId = addGoalTeam.value === 'local' ? selectedFixture.value.equipo_local_id : selectedFixture.value.equipo_visitante_id
  try {
    await supabase.from('goles').insert({
      resultado_id: resultado.value.id,
      jugador_id: addGoalJugador.value,
      equipo_id: equipoId,
      minuto: parseInt(addGoalMinuto.value)
    })
    await recomputar()
    toast.success('⚽ Gol agregado')
    addGoalJugador.value = null
    addGoalMinuto.value = ''
  } catch (e) { toast.error('Error al agregar gol')
  } finally { addGoalSaving.value = false }
}

async function finalizarPartido() {
  if (!resultado.value || !confirm('¿Finalizar el partido?')) return
  try {
    await supabase.from('resultados').update({ estado: 'finalizado' }).eq('id', resultado.value.id)
    await recomputar()
    toast.success('✅ Partido finalizado')
  } catch (e) { toast.error('Error al finalizar')
  }
}

async function recomputar() {
  const [rs, gls] = await Promise.all([
    supabase.from('resultados').select('*').eq('torneo_id', torneo.torneoActual),
    supabase.from('goles').select('*, jugador:jugadores(nombre)')
  ])
  resultados.value = rs.data || []
  goles.value = gls.data || []
}

async function loadData() {
  if (!torneo.torneoActual) return
  loading.value = true
  try {
    const [fx, rs, eqs, jgs] = await Promise.all([
      db.getFixture(torneo.torneoActual),
      supabase.from('resultados').select('*').eq('torneo_id', torneo.torneoActual),
      db.getEquipos(torneo.torneoActual),
      db.getJugadores(torneo.torneoActual)
    ])
    fixture.value = fx
    equipos.value = eqs
    jugadores.value = jgs
    await recomputar()
    if (!fixtureId.value && fx.length) fixtureId.value = fx[0].id
  } finally { loading.value = false }
}

onMounted(async () => {
  if (torneo.torneoActual) await loadData()
  pollTimer = setInterval(loadData, 10000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<template>
  <section>
    <div class="box">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <select v-model="fixtureId" style="flex:1;">
          <option v-for="f in fixture" :key="f.id" :value="f.id">
            {{ getEq(f.equipo_local_id)?.nombre }} vs {{ getEq(f.equipo_visitante_id)?.nombre }} — {{ f.fecha }}
          </option>
        </select>
        <button v-if="auth.isAdmin || auth.isDelegado" class="btn-mini" style="background:#eab308;color:black;" @click="showAddGoal=!showAddGoal">
          {{ showAddGoal ? '✕' : '⚽ Gol' }}
        </button>
        <button v-if="(auth.isAdmin||auth.isDelegado) && resultado && resultado.estado!=='finalizado'" class="btn-mini" style="background:#ef4444;color:white;" @click="finalizarPartido">
          🏁 Finalizar
        </button>
      </div>
    </div>

    <div v-if="loading" class="box spinner"><div class="spinner-ring"></div></div>

    <template v-else-if="selectedFixture">
      <!-- Scoreboard -->
      <div class="box" style="text-align:center; padding:30px;">
        <div style="display:flex; justify-content:center; align-items:center; gap:20px;">
          <div style="flex:1; text-align:right;">
            <div v-if="getEq(selectedFixture.equipo_local_id)?.logo" style="width:60px;height:60px;margin:0 auto 8px;">
              <img :src="getEq(selectedFixture.equipo_local_id).logo" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />
            </div>
            <h3 style="color:white; margin:0;">{{ getEq(selectedFixture.equipo_local_id)?.nombre }}</h3>
          </div>
          <div style="flex-shrink:0;">
            <div style="font-size:3.5rem; font-weight:900; color:#eab308; min-width:120px;">
              {{ golesLocal.length }} - {{ golesVisit.length }}
            </div>
            <span style="color:var(--text-muted); font-size:0.8rem;" v-if="resultado">
              {{ resultado.estado === 'finalizado' ? '✅ Finalizado' : '🔄 En vivo' }}
            </span>
          </div>
          <div style="flex:1; text-align:left;">
            <div v-if="getEq(selectedFixture.equipo_visitante_id)?.logo" style="width:60px;height:60px;margin:0 auto 8px;">
              <img :src="getEq(selectedFixture.equipo_visitante_id).logo" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />
            </div>
            <h3 style="color:white; margin:0;">{{ getEq(selectedFixture.equipo_visitante_id)?.nombre }}</h3>
          </div>
        </div>
      </div>

      <!-- Goals list -->
      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">⚽ Goles</h4>
        <div v-if="golesDelPartido.length === 0" style="color:var(--text-muted); text-align:center; padding:15px;">
          Sin goles todavía
        </div>
        <div v-for="g in golesDelPartido" :key="g.id"
          style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border);"
        >
          <span style="font-size:1.2rem;">⚽</span>
          <span style="color:white; font-weight:600;">{{ g.jugador?.nombre || getJugador(g.jugador_id)?.nombre }}</span>
          <span style="color:var(--text-muted); font-size:0.8rem;">{{ g.minuto }}'</span>
          <span style="margin-left:auto; font-size:0.75rem; color:var(--text-muted);">
            {{ getEq(g.equipo_id)?.nombre }}
          </span>
        </div>
      </div>

      <!-- Add goal form -->
      <div v-if="showAddGoal && resultado && resultado.estado !== 'finalizado'" class="box" style="border-left:4px solid #22c55e;">
        <h4 style="color:#22c55e; margin-bottom:10px;">⚽ Agregar Gol</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <label class="label-accent">Equipo:</label>
            <select v-model="addGoalTeam">
              <option value="local">{{ getEq(selectedFixture.equipo_local_id)?.nombre }}</option>
              <option value="visitante">{{ getEq(selectedFixture.equipo_visitante_id)?.nombre }}</option>
            </select>
          </div>
          <div>
            <label class="label-accent">Minuto:</label>
            <input type="number" v-model.number="addGoalMinuto" min="1" max="120" placeholder="Ej: 23" />
          </div>
        </div>
        <label class="label-accent">Jugador:</label>
        <select v-model="addGoalJugador" style="width:100%;">
          <option :value="null">Seleccionar jugador...</option>
          <option v-for="j in (addGoalTeam === 'local' ? jugadoresLocal : jugadoresVisit)" :key="j.id" :value="j.id">
            {{ j.nombre }}
          </option>
        </select>
        <button class="btn-main" @click="addGoal" :disabled="addGoalSaving || !addGoalJugador || !addGoalMinuto"
          style="background:#22c55e; color:white; margin-top:10px;">
          {{ addGoalSaving ? '⏳' : '⚽ Agregar Gol' }}
        </button>
      </div>
    </template>

    <div v-else class="box" style="text-align:center; padding:40px; color:var(--text-muted);">
      Seleccioná un partido para ver el modo live
    </div>
  </section>
</template>
