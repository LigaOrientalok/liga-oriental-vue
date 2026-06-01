<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { supabase } from '../lib/supabase'
import { useTorneoStore } from '../stores/torneoStore'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import { db } from '../lib/db'
import { notificarResultado, pedirPermisoNotificaciones } from '../lib/notifications'

const torneo = useTorneoStore()
const auth = useAuthStore()
const toast = useToastStore()

// Fixture display
const fixture = ref([])
const resultados = ref([])
const equipos = ref([])
const jugadores = ref([])
const loading = ref(false)
const saving = ref(false)
const modalConfirm = ref(null)

function waitConfirm(msg) {
  return new Promise(resolve => {
    modalConfirm.value = { message: msg, resolve }
  })
}

function onConfirm(ok) {
  if (modalConfirm.value) {
    modalConfirm.value.resolve(ok)
    modalConfirm.value = null
  }
}

// Fixture generation
const fixDiaGen = ref('Lunes')
const fixHoraInicio = ref('20:00')
const fixDuracion = ref(30)

// Result form
const diaFiltro = ref('')
const resE1 = ref('')
const resE2 = ref('')
const resG1 = ref(0)
const resG2 = ref(0)
const resMVP = ref('')
const resFiId = ref(null)
const resEditMode = ref(false)

const golesE1 = ref([])
const golesE2 = ref([])
const tarjetasE1 = ref([])
const tarjetasE2 = ref([])
let golKey = 0
let tarjetaKey = 0

const equiposDia = computed(() => {
  if (!diaFiltro.value) return []
  return equipos.value.filter(e => e.dia_semana === diaFiltro.value)
})

const jugadoresE1 = computed(() => {
  if (!resE1.value) return []
  return jugadores.value.filter(j => j.equipos?.includes(parseInt(resE1.value)))
})

const jugadoresE2 = computed(() => {
  if (!resE2.value) return []
  return jugadores.value.filter(j => j.equipos?.includes(parseInt(resE2.value)))
})

const jugadoresDelPartido = computed(() => {
  const ids = new Set()
  jugadoresE1.value.forEach(j => ids.add(j))
  jugadoresE2.value.forEach(j => ids.add(j))
  return jugadores.value.filter(j => ids.has(j) || (j.equipos?.includes(parseInt(resE1.value)) || j.equipos?.includes(parseInt(resE2.value))))
})

const fixtureAgrupado = computed(() => {
  const grupos = {}
  fixture.value.forEach(m => {
    const k = `${m.dia_semana} - ${m.fecha}`
    if (!grupos[k]) grupos[k] = []
    grupos[k].push(m)
  })
  return grupos
})

const resPorFixture = computed(() => {
  const map = {}
  resultados.value.forEach(r => { if (r.fixture_id) map[r.fixture_id] = r })
  return map
})

function getEqName(id) {
  const eq = equipos.value.find(e => e.id === id)
  return eq ? eq.nombre : `Equipo ${id}`
}

async function loadData() {
  if (!torneo.torneoActual) return
  loading.value = true
  try {
    const [f, r, e, j] = await Promise.all([
      db.getFixture(torneo.torneoActual),
      db.getResultados(torneo.torneoActual),
      db.getEquipos(torneo.torneoActual),
      db.getJugadores(torneo.torneoActual)
    ])
    fixture.value = f
    resultados.value = r
    equipos.value = e
    jugadores.value = j
  } finally {
    loading.value = false
  }
}

watch(() => torneo.torneoActual, async () => {
  if (torneo.torneoActual) try { await loadData() } catch (e) { console.error(e) }
})

watch(diaFiltro, () => {
  resE1.value = ''
  resE2.value = ''
})

// Fixture generation
async function generarFixtureAuto() {
  if (!torneo.torneoActual) return toast.error('Selecciona un torneo')

  saving.value = true
  try {
    const equiposDiaGen = equipos.value.filter(e => e.dia_semana === fixDiaGen.value).map(e => e.nombre)
    if (equiposDiaGen.length < 2) return toast.error('Necesitas más equipos')

    const existingFixture = fixture.value.filter(f => f.dia_semana === fixDiaGen.value)
    if (existingFixture.length > 0) {
      if (!await waitConfirm('Ya existe un fixture para este día. ¿Agregar más partidos?')) return
    }

    let equiposList = [...equiposDiaGen]
    if (equiposList.length % 2 !== 0) equiposList.push('DESCANSA')

    const numE = equiposList.length
    for (let r = 0; r < numE - 1; r++) {
      let fechaH = new Date(); fechaH.setHours(...fixHoraInicio.value.split(':').map(Number), 0, 0)
      for (let p = 0; p < numE / 2; p++) {
        const local = equiposList[p]
        const visitante = equiposList[numE - 1 - p]
        if (local !== 'DESCANSA' && visitante !== 'DESCANSA') {
          const localEq = equipos.value.find(e => e.nombre === local)
          const visitanteEq = equipos.value.find(e => e.nombre === visitante)
          if (localEq && visitanteEq) {
            await db.createFixture(
              torneo.torneoActual, fixDiaGen.value, `Fecha ${r + 1}`,
              fechaH.toTimeString().substring(0, 5),
              localEq.id, visitanteEq.id
            )
          }
          fechaH.setMinutes(fechaH.getMinutes() + fixDuracion.value)
        }
      }
      equiposList.splice(1, 0, equiposList.pop())
    }
    toast.success('✅ Fixture Generado')
    await loadData()
  } finally {
    saving.value = false
  }
}

// Result form
function agregarGol(lado) {
  const item = { _key: ++golKey, jugador: null }
  if (lado === 'E1') golesE1.value.push(item)
  else golesE2.value.push(item)
}

function quitarGol(lado, key) {
  if (lado === 'E1') golesE1.value = golesE1.value.filter(g => g._key !== key)
  else golesE2.value = golesE2.value.filter(g => g._key !== key)
}

function agregarTarjeta(lado) {
  const item = { _key: ++tarjetaKey, jugador_id: null, tipo: 'A' }
  if (lado === 'E1') tarjetasE1.value.push(item)
  else tarjetasE2.value.push(item)
}

function quitarTarjeta(lado, key) {
  if (lado === 'E1') tarjetasE1.value = tarjetasE1.value.filter(t => t._key !== key)
  else tarjetasE2.value = tarjetasE2.value.filter(t => t._key !== key)
}

async function cargarResultadoDeFixture(fixtureId) {
  const match = fixture.value.find(m => m.id === fixtureId)
  if (!match) return toast.error('Partido no encontrado')

  diaFiltro.value = match.dia_semana
  await nextTick()
  resE1.value = match.equipo_local_id.toString()
  resE2.value = match.equipo_visitante_id.toString()
  resFiId.value = fixtureId
  resEditMode.value = false
  resG1.value = 0
  resG2.value = 0
  golesE1.value = []
  golesE2.value = []
  tarjetasE1.value = []
  tarjetasE2.value = []
  resMVP.value = ''

  toast.success('✅ Partido cargado. Completá el resultado.')
}

async function cargarEdicionResultado(fixtureId) {
  await cargarResultadoDeFixture(fixtureId)
  resEditMode.value = true
  toast.success('Modo edición: se reemplazará el resultado anterior')
}

async function guardarResultado() {
  if (!torneo.torneoActual) return
  const e1Id = parseInt(resE1.value)
  const e2Id = parseInt(resE2.value)
  const g1 = parseInt(resG1.value) || 0
  const g2 = parseInt(resG2.value) || 0
  const mvpId = resMVP.value ? parseInt(resMVP.value) : null

  if (!e1Id || !e2Id) return toast.error('Seleccioná ambos equipos')

  saving.value = true
  try {
    const e1 = equipos.value.find(x => x.id === e1Id)
    const e2 = equipos.value.find(x => x.id === e2Id)
    if (!e1 || !e2) return toast.error('Equipos no encontrados')

    if (resEditMode.value && resFiId.value) {
      if (!await waitConfirm('¿Guardar cambios? Se reemplazará el resultado anterior.')) {
        saving.value = false
        return
      }
    }

    // Create result
    const resultado = await db.createResultado(torneo.torneoActual, resFiId.value, e1Id, e2Id, g1, g2, mvpId)
    if (!resultado) { toast.error('Error al guardar el resultado'); return }
    const resId = resultado.id

    // Update team stats
    const newE1 = { ...e1, pj: (e1.pj || 0) + 1, gf: (e1.gf || 0) + g1, gc: (e1.gc || 0) + g2 }
    const newE2 = { ...e2, pj: (e2.pj || 0) + 1, gf: (e2.gf || 0) + g2, gc: (e2.gc || 0) + g1 }

    if (g1 > g2) {
      newE1.v = (e1.v || 0) + 1; newE1.pts = (e1.pts || 0) + 3; newE2.p = (e2.p || 0) + 1
    } else if (g2 > g1) {
      newE2.v = (e2.v || 0) + 1; newE2.pts = (e2.pts || 0) + 3; newE1.p = (e1.p || 0) + 1
    } else {
      newE1.e = (e1.e || 0) + 1; newE2.e = (e2.e || 0) + 1
      newE1.pts = (e1.pts || 0) + 1; newE2.pts = (e2.pts || 0) + 1
    }

    if (g2 === 0) newE1.vallas_invictas = (e1.vallas_invictas || 0) + 1
    if (g1 === 0) newE2.vallas_invictas = (e2.vallas_invictas || 0) + 1

    await db.updateEquipo(e1.id, newE1)
    await db.updateEquipo(e2.id, newE2)

    // Build player deltas
    const deltas = {}
    function addDelta(pid, field, val) {
      if (!deltas[pid]) deltas[pid] = { pj: false, goles: 0, amarillas: 0, rojas: 0, mvps: 0 }
      if (field === 'pj') deltas[pid].pj = true
      else deltas[pid][field] = (deltas[pid][field] || 0) + val
    }

    golesE1.value.forEach(g => { const pid = g.jugador; if (pid) addDelta(parseInt(pid), 'goles', 1) })
    golesE2.value.forEach(g => { const pid = g.jugador; if (pid) addDelta(parseInt(pid), 'goles', 1) })

    tarjetasE1.value.forEach(t => { if (t.jugador_id) addDelta(parseInt(t.jugador_id), t.tipo === 'A' ? 'amarillas' : 'rojas', 1) })
    tarjetasE2.value.forEach(t => { if (t.jugador_id) addDelta(parseInt(t.jugador_id), t.tipo === 'A' ? 'amarillas' : 'rojas', 1) })

    if (mvpId) addDelta(mvpId, 'mvps', 1)

    for (const [pid, d] of Object.entries(deltas)) {
      const base = jugadores.value.find(j => j.id === parseInt(pid))
      if (!base) continue
      const upd = {}
      if (d.pj) upd.pj = (base.pj || 0) + 1
      if (d.goles) upd.goles = (base.goles || 0) + d.goles
      if (d.amarillas) upd.amarillas = (base.amarillas || 0) + d.amarillas
      if (d.rojas) upd.rojas = (base.rojas || 0) + d.rojas
      if (d.mvps) upd.mvps = (base.mvps || 0) + d.mvps
      await db.updateJugador(parseInt(pid), upd)
    }

    // Create goal/card records
    const allGoalPromises = [
      ...golesE1.value.filter(g => g.jugador).map(g => db.createGol(resId, parseInt(g.jugador), e1Id, null)),
      ...golesE2.value.filter(g => g.jugador).map(g => db.createGol(resId, parseInt(g.jugador), e2Id, null))
    ]
    const allCardPromises = [
      ...tarjetasE1.value.filter(t => t.jugador_id).map(t => db.createTarjeta(resId, parseInt(t.jugador_id), e1Id, t.tipo, null)),
      ...tarjetasE2.value.filter(t => t.jugador_id).map(t => db.createTarjeta(resId, parseInt(t.jugador_id), e2Id, t.tipo, null))
    ]
    await Promise.all([...allGoalPromises, ...allCardPromises])

    // If editing, delete old result
    if (resEditMode.value && resFiId.value) {
      await eliminarResultado(resFiId.value)
      resEditMode.value = false
    }

    notificarResultado(e1.nombre, e2.nombre, g1, g2)
    toast.success('¡Resultado guardado!')
    await loadData()
    limpiarFormulario()
  } catch (e) {
    toast.error('Error al guardar resultado')
    console.error(e)
  } finally {
    saving.value = false
  }
}

async function eliminarResultado(partidoFixtureId) {
  const res = resultados.value.find(r => r.fixture_id === partidoFixtureId)
  if (!res) return

  const e1 = equipos.value.find(e => e.id === res.equipo_local_id)
  const e2 = equipos.value.find(e => e.id === res.equipo_visitante_id)
  if (!e1 || !e2) return

  // Revert team stats
  const revertE1 = { ...e1, pj: Math.max(0, (e1.pj || 0) - 1), gf: Math.max(0, (e1.gf || 0) - res.goles_local), gc: Math.max(0, (e1.gc || 0) - res.goles_visitante) }
  const revertE2 = { ...e2, pj: Math.max(0, (e2.pj || 0) - 1), gf: Math.max(0, (e2.gf || 0) - res.goles_visitante), gc: Math.max(0, (e2.gc || 0) - res.goles_local) }

  if (res.goles_local > res.goles_visitante) {
    revertE1.v = Math.max(0, (e1.v || 0) - 1); revertE1.pts = Math.max(0, (e1.pts || 0) - 3); revertE2.p = Math.max(0, (e2.p || 0) - 1)
  } else if (res.goles_visitante > res.goles_local) {
    revertE2.v = Math.max(0, (e2.v || 0) - 1); revertE2.pts = Math.max(0, (e2.pts || 0) - 3); revertE1.p = Math.max(0, (e1.p || 0) - 1)
  } else {
    revertE1.e = Math.max(0, (e1.e || 0) - 1); revertE2.e = Math.max(0, (e2.e || 0) - 1)
    revertE1.pts = Math.max(0, (e1.pts || 0) - 1); revertE2.pts = Math.max(0, (e2.pts || 0) - 1)
  }

  if (res.goles_visitante === 0) revertE1.vallas_invictas = Math.max(0, (e1.vallas_invictas || 0) - 1)
  if (res.goles_local === 0) revertE2.vallas_invictas = Math.max(0, (e2.vallas_invictas || 0) - 1)

  await db.updateEquipo(e1.id, revertE1)
  await db.updateEquipo(e2.id, revertE2)

  // Revert player stats
  const [goles, tarjetas] = await Promise.all([
    db.getGoles(res.id),
    db.getTarjetas(res.id)
  ])

  const deltas = {}
  function addDelta(pid, field, val) {
    if (!deltas[pid]) deltas[pid] = { pj: false, goles: 0, amarillas: 0, rojas: 0, mvps: 0 }
    if (field === 'pj') deltas[pid].pj = true
    else deltas[pid][field] = (deltas[pid][field] || 0) + val
  }

  goles.forEach(gol => addDelta(gol.jugador_id, 'goles', -1))
  tarjetas.forEach(tarj => addDelta(tarj.jugador_id, tarj.tipo === 'A' ? 'amarillas' : 'rojas', -1))
  if (res.mvp_id) addDelta(res.mvp_id, 'mvps', -1)

  for (const [pid, d] of Object.entries(deltas)) {
    const base = jugadores.value.find(j => j.id === parseInt(pid))
    if (!base) continue
    const upd = {}
    if (d.pj) upd.pj = Math.max(0, (base.pj || 0) - 1)
    if (d.goles) upd.goles = Math.max(0, (base.goles || 0) + d.goles)
    if (d.amarillas) upd.amarillas = Math.max(0, (base.amarillas || 0) + d.amarillas)
    if (d.rojas) upd.rojas = Math.max(0, (base.rojas || 0) + d.rojas)
    if (d.mvps) upd.mvps = Math.max(0, (base.mvps || 0) + d.mvps)
    await db.updateJugador(parseInt(pid), upd)
  }

  await Promise.all([
    db.deleteGolesByResultado(res.id),
    db.deleteTarjetasByResultado(res.id)
  ])
  await db.deleteResultado(res.id)
}

async function eliminarPartido(id) {
  if (!await waitConfirm('¿Eliminar este partido del fixture?')) return
  try {
    const { error } = await supabase.from('fixture').delete().eq('id', id)
    if (error) throw error
    toast.success('🗑️ Partido eliminado')
    await loadData()
  } catch (e) {
    toast.error('Error al eliminar: ' + e.message)
  }
}

async function eliminarResultadoCompleto(fixtureId) {
  if (!await waitConfirm('¿Eliminar este resultado? Se revertirán todas las estadísticas.')) return
  try {
    await eliminarResultado(fixtureId)
    toast.success('Resultado eliminado y estadísticas revertidas')
    await loadData()
  } catch (e) {
    toast.error('Error al eliminar resultado')
  }
}

function limpiarFormulario() {
  diaFiltro.value = ''
  resE1.value = ''
  resE2.value = ''
  resG1.value = 0
  resG2.value = 0
  resMVP.value = ''
  resFiId.value = null
  resEditMode.value = false
  golesE1.value = []
  golesE2.value = []
  tarjetasE1.value = []
  tarjetasE2.value = []
}

onMounted(async () => {
  if (torneo.torneoActual) try { await loadData() } catch (e) { console.error(e) }
})
</script>

<template>
  <section>
    <!-- Fixture Generation (admin only) -->
    <div v-if="auth.isAdmin" class="box">
      <h3>📅 Generar Fixture</h3>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:end;">
        <div>
          <label class="label-accent">Día:</label>
          <select v-model="fixDiaGen" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
            <option>Lunes</option><option value="Miercoles">Miércoles</option><option>Jueves</option><option>Viernes</option><option value="Sabado">Sábado</option><option>Domingo</option>
          </select>
        </div>
        <div>
          <label class="label-accent">Hora inicio:</label>
          <input type="time" v-model="fixHoraInicio" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
        </div>
        <div>
          <label class="label-accent">Duración (min):</label>
          <input type="number" v-model.number="fixDuracion" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border); width:80px;">
        </div>
        <button @click="generarFixtureAuto" class="btn-mini" style="background:#22c55e; color:white;" :disabled="saving">
          {{ saving ? '⏳' : 'Generar Fixture' }}
        </button>
      </div>
    </div>

    <!-- Fixture Display -->
    <div class="box">
      <h3>📋 Fixture</h3>
      <div v-if="loading" style="text-align:center; color:var(--text-accent); padding:20px;">Cargando...</div>
      <div v-else-if="fixture.length === 0" style="color:var(--text-muted);">No hay partidos en el fixture</div>
      <div v-else>
        <div v-for="(matches, titulo) in fixtureAgrupado" :key="titulo" style="margin-bottom:20px;">
          <h3>{{ titulo }}</h3>
          <div
            v-for="m in matches"
            :key="m.id"
            class="fixture-item"
            :class="resPorFixture[m.id] ? 'finalizado' : 'pendiente'"
            style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:var(--bg-input); border-radius:8px; margin-bottom:10px;"
          >
            <span style="font-weight:600; color:#eab308; min-width:50px;">{{ m.hora }}</span>
            <div style="flex:1; text-align:right; font-weight:600;">{{ getEqName(m.equipo_local_id) }}</div>
            <div style="margin:0 15px; font-size:0.9rem; font-weight:700; color:var(--text-muted);">
              <template v-if="resPorFixture[m.id]">
                <span style="color:#22c55e;">{{ resPorFixture[m.id].goles_local }} - {{ resPorFixture[m.id].goles_visitante }}</span>
              </template>
              <template v-else>VS</template>
            </div>
            <div style="flex:1; font-weight:600;">{{ getEqName(m.equipo_visitante_id) }}</div>
            <div v-if="auth.isAdmin" style="display:flex; gap:5px; margin-left:10px;">
              <template v-if="resPorFixture[m.id]">
                <button @click="cargarEdicionResultado(m.id)" class="btn-mini" style="background:#3b82f6; color:white; padding:4px 10px; font-size:0.75rem;">✏️</button>
                <button @click="eliminarResultadoCompleto(m.id)" class="btn-mini" style="background:#ef4444; color:white; padding:4px 10px; font-size:0.75rem;">🗑️</button>
              </template>
              <template v-else>
                <button @click="cargarResultadoDeFixture(m.id)" class="btn-mini" style="background:#22c55e; color:white; padding:4px 10px; font-size:0.75rem;">⚽</button>
                <button @click="eliminarPartido(m.id)" class="btn-mini" style="background:#ef4444; color:white; padding:4px 10px; font-size:0.75rem;">🗑️</button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Result Form (admin only) -->
    <div v-if="auth.isAdmin" class="box">
      <h3>⚽ Cargar Resultado</h3>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <div>
          <label class="label-accent">Día:</label>
          <select v-model="diaFiltro" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
            <option value="">Seleccionar...</option>
            <option>Lunes</option><option value="Miercoles">Miércoles</option><option>Jueves</option><option>Viernes</option><option value="Sabado">Sábado</option><option>Domingo</option>
          </select>
        </div>
        <div>
          <label class="label-accent">Local:</label>
          <select v-model="resE1" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
            <option value="">Seleccionar...</option>
            <option v-for="eq in equiposDia" :key="eq.id" :value="eq.id">{{ eq.nombre }}</option>
          </select>
        </div>
        <div>
          <label class="label-accent">Visitante:</label>
          <select v-model="resE2" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
            <option value="">Seleccionar...</option>
            <option v-for="eq in equiposDia" :key="eq.id" :value="eq.id">{{ eq.nombre }}</option>
          </select>
        </div>
        <div>
          <label class="label-accent">Goles Local:</label>
          <input type="number" v-model.number="resG1" min="0" style="width:60px; padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
        </div>
        <div>
          <label class="label-accent">Goles Visit:</label>
          <input type="number" v-model.number="resG2" min="0" style="width:60px; padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
        </div>
        <div>
          <label class="label-accent">MVP:</label>
          <select v-model="resMVP" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
            <option value="">Sin MVP</option>
            <option v-for="j in jugadoresDelPartido" :key="j.id" :value="j.id">{{ j.nombre }}</option>
          </select>
        </div>
      </div>

      <!-- Goal Scorers -->
      <div style="display:flex; gap:20px; margin-top:15px;">
        <div style="flex:1;">
          <label class="label-accent">Goleadores Local</label>
          <div v-for="gol in golesE1" :key="gol._key" style="display:flex; gap:5px; margin-bottom:5px;">
            <select v-model="gol.jugador" style="flex:1; padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option :value="null">Seleccionar...</option>
              <option v-for="j in jugadoresE1" :key="j.id" :value="j.id">{{ j.nombre }}</option>
            </select>
            <button @click="quitarGol('E1', gol._key)" style="background:#ef4444; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">X</button>
          </div>
          <button @click="agregarGol('E1')" class="btn-mini" style="background:#3b82f6; color:white;">+ Gol Local</button>
        </div>
        <div style="flex:1;">
          <label class="label-accent">Goleadores Visitante</label>
          <div v-for="gol in golesE2" :key="gol._key" style="display:flex; gap:5px; margin-bottom:5px;">
            <select v-model="gol.jugador" style="flex:1; padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option :value="null">Seleccionar...</option>
              <option v-for="j in jugadoresE2" :key="j.id" :value="j.id">{{ j.nombre }}</option>
            </select>
            <button @click="quitarGol('E2', gol._key)" style="background:#ef4444; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">X</button>
          </div>
          <button @click="agregarGol('E2')" class="btn-mini" style="background:#3b82f6; color:white;">+ Gol Visit</button>
        </div>
      </div>

      <!-- Cards -->
      <div style="display:flex; gap:20px; margin-top:15px;">
        <div style="flex:1;">
          <label class="label-accent">Tarjetas Local</label>
          <div v-for="t in tarjetasE1" :key="t._key" style="display:flex; gap:5px; margin-bottom:5px;">
            <select v-model="t.jugador_id" style="flex:1; padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option :value="null">Seleccionar...</option>
              <option v-for="j in jugadoresE1" :key="j.id" :value="j.id">{{ j.nombre }}</option>
            </select>
            <select v-model="t.tipo" style="width:60px; padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option value="A">🟨</option>
              <option value="R">🟥</option>
            </select>
            <button @click="quitarTarjeta('E1', t._key)" style="background:#ef4444; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">X</button>
          </div>
          <button @click="agregarTarjeta('E1')" class="btn-mini" style="background:#f97316; color:white;">+ Tarjeta Local</button>
        </div>
        <div style="flex:1;">
          <label class="label-accent">Tarjetas Visitante</label>
          <div v-for="t in tarjetasE2" :key="t._key" style="display:flex; gap:5px; margin-bottom:5px;">
            <select v-model="t.jugador_id" style="flex:1; padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option :value="null">Seleccionar...</option>
              <option v-for="j in jugadoresE2" :key="j.id" :value="j.id">{{ j.nombre }}</option>
            </select>
            <select v-model="t.tipo" style="width:60px; padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option value="A">🟨</option>
              <option value="R">🟥</option>
            </select>
            <button @click="quitarTarjeta('E2', t._key)" style="background:#ef4444; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">X</button>
          </div>
          <button @click="agregarTarjeta('E2')" class="btn-mini" style="background:#f97316; color:white;">+ Tarjeta Visit</button>
        </div>
      </div>

      <button @click="guardarResultado" class="btn-main" style="margin-top:15px;" :disabled="saving">
        {{ saving ? '⏳ Guardando...' : '✅ GUARDAR RESULTADO' }}
      </button>
    </div>

    <!-- Confirm Modal -->
    <div v-if="modalConfirm" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:9999;" @click.self="onConfirm(false)">
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:30px; max-width:400px; width:90%; text-align:center;">
        <p style="color:var(--text); margin-bottom:20px;">{{ modalConfirm.message }}</p>
        <div style="display:flex; gap:10px; justify-content:center;">
          <button @click="onConfirm(true)" class="btn-mini" style="background:#ef4444; color:white; padding:10px 24px;">Sí</button>
          <button @click="onConfirm(false)" class="btn-mini" style="background:var(--btn-bg); color:var(--text); padding:10px 24px;">No</button>
        </div>
      </div>
    </div>
  </section>
</template>
