<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTorneoStore } from '../stores/torneoStore'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { calcularRating } from '../lib/playerStats'

const router = useRouter()
const torneo = useTorneoStore()

const activeTab = ref('jugadores')
const loading = ref(true)
const equipos = ref([])
const jugadores = ref([])
const fixture = ref([])
const resultados = ref([])
const allGoles = ref([])
const allTarjetas = ref([])

const jugadorA = ref(null)
const jugadorB = ref(null)
const equipoA = ref(null)
const equipoB = ref(null)

const DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#1e293b" width="100" height="100"/><circle fill="#475569" cx="50" cy="40" r="20"/><path fill="#475569" d="M20 85c0-15 13.4-25 30-25s30 10 30 25"/></svg>')

const jugadoresOptions = computed(() => {
  return jugadores.value.map(j => ({
    ...j,
    label: `${j.nombre} (${j.posicion})`,
    equipo: equipos.value.find(e => j.equipos?.includes(e.id))
  }))
})

const equiposOptions = computed(() => equipos.value)

const jugadorAStats = computed(() => {
  if (!jugadorA.value) return null
  return calcularStatsJugador(jugadorA.value)
})

const jugadorBStats = computed(() => {
  if (!jugadorB.value) return null
  return calcularStatsJugador(jugadorB.value)
})

const equipoAStats = computed(() => {
  if (!equipoA.value) return null
  return equipoA.value
})

const equipoBStats = computed(() => {
  if (!equipoB.value) return null
  return equipoB.value
})

const h2hJugadores = computed(() => {
  if (!jugadorA.value || !jugadorB.value) return []
  const jugAId = jugadorA.value.id
  const jugBId = jugadorB.value.id

  return resultados.value
    .filter(r => {
      const golesA = allGoles.value.filter(g => g.resultado_id === r.id && g.jugador_id === jugAId)
      const golesB = allGoles.value.filter(g => g.resultado_id === r.id && g.jugador_id === jugBId)
      return golesA.length > 0 || golesB.length > 0
    })
    .map(r => {
      const f = fixture.value.find(x => x.id === r.fixture_id)
      const golesA = allGoles.value.filter(g => g.resultado_id === r.id && g.jugador_id === jugAId)
      const golesB = allGoles.value.filter(g => g.resultado_id === r.id && g.jugador_id === jugBId)
      const eqLocal = equipos.value.find(e => e.id === r.equipo_local_id)
      const eqVisitante = equipos.value.find(e => e.id === r.equipo_visitante_id)
      return {
        fecha: f?.fecha || '-',
        local: eqLocal?.nombre || '?',
        visitante: eqVisitante?.nombre || '?',
        goles_local: r.goles_local,
        goles_visitante: r.goles_visitante,
        golesA,
        golesB,
        ganador: r.goles_local > r.goles_visitante ? 'local' : r.goles_visitante > r.goles_local ? 'visitante' : 'empate'
      }
    })
})

const h2hEquipos = computed(() => {
  if (!equipoA.value || !equipoB.value) return []
  const eqAId = equipoA.value.id
  const eqBId = equipoB.value.id

  return resultados.value
    .filter(r =>
      (r.equipo_local_id === eqAId && r.equipo_visitante_id === eqBId) ||
      (r.equipo_local_id === eqBId && r.equipo_visitante_id === eqAId)
    )
    .map(r => {
      const f = fixture.value.find(x => x.id === r.fixture_id)
      const eqLocal = equipos.value.find(e => e.id === r.equipo_local_id)
      const eqVisitante = equipos.value.find(e => e.id === r.equipo_visitante_id)
      const esLocalA = r.equipo_local_id === eqAId
      return {
        fecha: f?.fecha || '-',
        local: eqLocal?.nombre || '?',
        visitante: eqVisitante?.nombre || '?',
        goles_local: r.goles_local,
        goles_visitante: r.goles_visitante,
        ganador: r.goles_local > r.goles_visitante
          ? (esLocalA ? 'A' : 'B')
          : r.goles_visitante > r.goles_local
            ? (esLocalA ? 'B' : 'A')
            : 'empate',
        golesA: esLocalA ? r.goles_local : r.goles_visitante,
        golesB: esLocalA ? r.goles_visitante : r.goles_local
      }
    })
})

function calcularStatsJugador(j) {
  return {
    goles: j.goles || 0,
    pj: j.pj || 0,
    mvps: j.mvps || 0,
    amarillas: j.amarillas || 0,
    rojas: j.rojas || 0,
    vallas_invictas: j.vallas_invictas || 0,
    rating: calcularRating(j),
    gpp: j.pj ? ((j.goles || 0) / j.pj).toFixed(2) : '0'
  }
}

function getPosicionClass(pos) {
  const map = { POR: 'pos-por', DFC: 'pos-def', MC: 'pos-mid', DEL: 'pos-del' }
  return map[pos] || ''
}

function getPosicionLabel(pos) {
  const map = { POR: 'POR', DFC: 'DEF', MC: 'MED', DEL: 'DEL' }
  return map[pos] || pos
}

function statsBar(valor, maximo) {
  if (!maximo) return '0%'
  return Math.min(100, (valor / maximo) * 100) + '%'
}

function irAJugador(id) {
  router.push('/jugador/' + id)
}

function irAEquipo(id) {
  router.push('/equipo/' + id)
}

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

    if (resultados.value.length) {
      const resIds = resultados.value.map(r => r.id)
      const [golRes, tarRes] = await Promise.all([
        supabase.from('goles').select('*').in('resultado_id', resIds),
        supabase.from('tarjetas').select('*').in('resultado_id', resIds)
      ])
      allGoles.value = golRes.data || []
      allTarjetas.value = tarRes.data || []
    }
  } finally { loading.value = false }
}

watch(() => torneo.torneoActual, async () => {
  jugadorA.value = null
  jugadorB.value = null
  equipoA.value = null
  equipoB.value = null
  await loadData()
})

onMounted(async () => { await loadData() })
</script>

<template>
  <section>
    <div v-if="loading" class="box spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>

    <template v-else-if="!torneo.torneoActual">
      <div class="box" style="text-align:center; color:var(--text-muted);">Seleccioná un torneo para comparar</div>
    </template>

    <template v-else>
      <div style="display:flex; gap:8px; margin-bottom:15px;">
        <button class="btn-sm" :class="activeTab === 'jugadores' ? 'btn-primary' : ''" @click="activeTab = 'jugadores'">⚔️ Jugadores</button>
        <button class="btn-sm" :class="activeTab === 'equipos' ? 'btn-primary' : ''" @click="activeTab = 'equipos'">⚔️ Equipos</button>
      </div>

      <!-- ========== TAB: JUGADORES ========== -->
      <template v-if="activeTab === 'jugadores'">
        <div style="display:grid; grid-template-columns: 1fr auto 1fr; gap:12px; align-items:start;">
          <!-- Player A -->
          <div class="box" style="padding:15px;">
            <label style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; display:block; margin-bottom:5px;">Jugador A</label>
            <select v-model="jugadorA" style="width:100%;">
              <option :value="null" disabled>Seleccionar jugador</option>
              <option v-for="j in jugadoresOptions" :key="j.id" :value="j">{{ j.label }}</option>
            </select>
          </div>

          <div style="display:flex; align-items:center; justify-content:center; padding-top:30px;">
            <span style="font-size:1.5rem; font-weight:bold; color:var(--gold);">VS</span>
          </div>

          <!-- Player B -->
          <div class="box" style="padding:15px;">
            <label style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; display:block; margin-bottom:5px;">Jugador B</label>
            <select v-model="jugadorB" style="width:100%;">
              <option :value="null" disabled>Seleccionar jugador</option>
              <option v-for="j in jugadoresOptions" :key="j.id" :value="j">{{ j.label }}</option>
            </select>
          </div>
        </div>

        <div v-if="jugadorA && jugadorB" style="margin-top:15px;">
          <!-- Player headers -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div class="box" style="text-align:center; padding:15px; cursor:pointer;" @click="irAJugador(jugadorA.id)">
              <div style="width:60px; height:60px; border-radius:50%; overflow:hidden; border:2px solid #eab308; margin:0 auto 8px;">
                <img :src="jugadorA.foto || DEFAULT_AVATAR" loading="lazy" style="width:100%; height:100%; object-fit:cover;" alt="">
              </div>
              <h3 style="color:#eab308; margin:0 0 4px;">{{ jugadorA.nombre }}</h3>
              <span :class="getPosicionClass(jugadorA.posicion)" style="display:inline-block; padding:2px 10px; border-radius:4px; font-size:0.75rem;">
                {{ getPosicionLabel(jugadorA.posicion) }}
              </span>
              <div v-if="jugadorA.equipo" style="color:var(--text-muted); font-size:0.8rem; margin-top:4px;">{{ jugadorA.equipo.nombre }}</div>
            </div>

            <div class="box" style="text-align:center; padding:15px; cursor:pointer;" @click="irAJugador(jugadorB.id)">
              <div style="width:60px; height:60px; border-radius:50%; overflow:hidden; border:2px solid #eab308; margin:0 auto 8px;">
                <img :src="jugadorB.foto || DEFAULT_AVATAR" loading="lazy" style="width:100%; height:100%; object-fit:cover;" alt="">
              </div>
              <h3 style="color:#eab308; margin:0 0 4px;">{{ jugadorB.nombre }}</h3>
              <span :class="getPosicionClass(jugadorB.posicion)" style="display:inline-block; padding:2px 10px; border-radius:4px; font-size:0.75rem;">
                {{ getPosicionLabel(jugadorB.posicion) }}
              </span>
              <div v-if="jugadorB.equipo" style="color:var(--text-muted); font-size:0.8rem; margin-top:4px;">{{ jugadorB.equipo.nombre }}</div>
            </div>
          </div>

          <!-- Stats comparison -->
          <div class="box" style="margin-top:12px;">
            <h4 style="color:#eab308; margin-bottom:12px;">📊 Comparación de Estadísticas</h4>
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border); color:var(--text-muted);"></th>
                  <th style="text-align:center; padding:8px; border-bottom:1px solid var(--border); color:#eab308;">{{ jugadorA.nombre }}</th>
                  <th style="text-align:center; padding:8px; border-bottom:1px solid var(--border); color:var(--text-muted);"></th>
                  <th style="text-align:center; padding:8px; border-bottom:1px solid var(--border); color:#eab308;">{{ jugadorB.nombre }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="stat in [
                  { key: 'goles', label: '⚽ Goles', maxKey: 'goles' },
                  { key: 'pj', label: '🏃 Partidos', maxKey: 'pj' },
                  { key: 'mvps', label: '⭐ MVP', maxKey: 'mvps' },
                  { key: 'amarillas', label: '🟨 Amarillas', maxKey: null },
                  { key: 'rojas', label: '🟥 Rojas', maxKey: null },
                  { key: 'vallas_invictas', label: '🧤 Vallas Inv.', maxKey: 'vallas_invictas' },
                  { key: 'rating', label: '📈 Rating', maxKey: null },
                  { key: 'gpp', label: '🎯 G/P', maxKey: null }
                ]" :key="stat.key"
>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); color:var(--text);">{{ stat.label }}</td>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); text-align:center; font-weight:bold; color:#eab308;">
                    {{ jugadorAStats ? jugadorAStats[stat.key] : '-' }}
                  </td>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); text-align:center;">
                    <div v-if="stat.maxKey" style="width:100px; height:6px; background:var(--border); border-radius:3px; overflow:hidden; margin:0 auto;">
                      <div v-if="jugadorAStats && jugadorBStats" style="display:flex; height:100%;">
                        <div :style="{ width: statsBar(jugadorAStats[stat.maxKey], Math.max(jugadorAStats[stat.maxKey], jugadorBStats[stat.maxKey])), background: '#eab308', height: '100%' }"></div>
                      </div>
                    </div>
                  </td>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); text-align:center; font-weight:bold; color:#eab308;">
                    {{ jugadorBStats ? jugadorBStats[stat.key] : '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Head-to-head matches -->
          <div class="box" style="margin-top:12px;">
            <h4 style="color:#eab308; margin-bottom:12px;">⚔️ Enfrentamientos Directos</h4>
            <div v-if="h2hJugadores.length === 0" style="color:var(--text-muted); text-align:center; padding:10px;">
              No se enfrentaron en partidos donde ambos anotaron
            </div>
            <div v-else class="overflow-table">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="text-align:left; padding:6px; border-bottom:1px solid var(--border); color:var(--text-muted);">Fecha</th>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid var(--border); color:var(--text-muted);">Partido</th>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid var(--border); color:var(--text-muted);">Resultado</th>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid var(--border); color:var(--text-muted);">{{ jugadorA.nombre }}</th>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid var(--border); color:var(--text-muted);">{{ jugadorB.nombre }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(m, i) in h2hJugadores" :key="i" style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px 6px; font-size:0.85rem;">{{ m.fecha }}</td>
                    <td style="padding:8px 6px; text-align:center; font-size:0.85rem;">{{ m.local }} vs {{ m.visitante }}</td>
                    <td style="padding:8px 6px; text-align:center; font-weight:bold; color:#eab308;">
                      {{ m.goles_local }} - {{ m.goles_visitante }}
                    </td>
                    <td style="padding:8px 6px; text-align:center; color:#22c55e;">
                      {{ m.golesA.length }} ⚽
                    </td>
                    <td style="padding:8px 6px; text-align:center; color:#22c55e;">
                      {{ m.golesB.length }} ⚽
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>

      <!-- ========== TAB: EQUIPOS ========== -->
      <template v-if="activeTab === 'equipos'">
        <div style="display:grid; grid-template-columns: 1fr auto 1fr; gap:12px; align-items:start;">
          <div class="box" style="padding:15px;">
            <label style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; display:block; margin-bottom:5px;">Equipo A</label>
            <select v-model="equipoA" style="width:100%;">
              <option :value="null" disabled>Seleccionar equipo</option>
              <option v-for="eq in equiposOptions" :key="eq.id" :value="eq">{{ eq.nombre }}</option>
            </select>
          </div>

          <div style="display:flex; align-items:center; justify-content:center; padding-top:30px;">
            <span style="font-size:1.5rem; font-weight:bold; color:var(--gold);">VS</span>
          </div>

          <div class="box" style="padding:15px;">
            <label style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; display:block; margin-bottom:5px;">Equipo B</label>
            <select v-model="equipoB" style="width:100%;">
              <option :value="null" disabled>Seleccionar equipo</option>
              <option v-for="eq in equiposOptions" :key="eq.id" :value="eq">{{ eq.nombre }}</option>
            </select>
          </div>
        </div>

        <div v-if="equipoA && equipoB" style="margin-top:15px;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div class="box" style="text-align:center; padding:15px; cursor:pointer;" @click="irAEquipo(equipoA.id)">
              <div style="width:60px; height:60px; border-radius:50%; overflow:hidden; border:2px solid #eab308; margin:0 auto 8px; display:flex; align-items:center; justify-content:center; background:var(--bg);">
                <img v-if="equipoA.logo" :src="equipoA.logo" loading="lazy" style="width:100%; height:100%; object-fit:cover;" alt="">
                <span v-else style="font-size:1.5rem;">🏆</span>
              </div>
              <h3 style="color:#eab308; margin:0;">{{ equipoA.nombre }}</h3>
              <div style="color:var(--text-muted); font-size:0.8rem;">{{ equipoA.dia_semana }}</div>
            </div>

            <div class="box" style="text-align:center; padding:15px; cursor:pointer;" @click="irAEquipo(equipoB.id)">
              <div style="width:60px; height:60px; border-radius:50%; overflow:hidden; border:2px solid #eab308; margin:0 auto 8px; display:flex; align-items:center; justify-content:center; background:var(--bg);">
                <img v-if="equipoB.logo" :src="equipoB.logo" loading="lazy" style="width:100%; height:100%; object-fit:cover;" alt="">
                <span v-else style="font-size:1.5rem;">🏆</span>
              </div>
              <h3 style="color:#eab308; margin:0;">{{ equipoB.nombre }}</h3>
              <div style="color:var(--text-muted); font-size:0.8rem;">{{ equipoB.dia_semana }}</div>
            </div>
          </div>

          <div class="box" style="margin-top:12px;">
            <h4 style="color:#eab308; margin-bottom:12px;">📊 Comparación de Estadísticas</h4>
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid var(--border); color:var(--text-muted);"></th>
                  <th style="text-align:center; padding:8px; border-bottom:1px solid var(--border); color:#eab308;">{{ equipoA.nombre }}</th>
                  <th style="text-align:center; padding:8px; border-bottom:1px solid var(--border); color:var(--text-muted);"></th>
                  <th style="text-align:center; padding:8px; border-bottom:1px solid var(--border); color:#eab308;">{{ equipoB.nombre }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="stat in [
                  { key: 'pts', label: '🏆 PTS', maxKey: 'pts' },
                  { key: 'pj', label: '🏃 PJ', maxKey: 'pj' },
                  { key: 'v', label: '✅ Victorias', maxKey: 'v' },
                  { key: 'e', label: '🤝 Empates', maxKey: null },
                  { key: 'p', label: '❌ Derrotas', maxKey: null },
                  { key: 'gf', label: '⚽ GF', maxKey: 'gf' },
                  { key: 'gc', label: '🥅 GC', maxKey: null },
                  { key: 'vallas_invictas', label: '🧤 Vallas Inv.', maxKey: 'vallas_invictas' }
                ]" :key="stat.key"
>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); color:var(--text);">{{ stat.label }}</td>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); text-align:center; font-weight:bold; color:#eab308;">
                    {{ equipoAStats ? equipoAStats[stat.key] ?? '-' : '-' }}
                  </td>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); text-align:center;">
                    <div v-if="stat.maxKey" style="width:100px; height:6px; background:var(--border); border-radius:3px; overflow:hidden; margin:0 auto;">
                      <div v-if="equipoAStats && equipoBStats" style="display:flex; height:100%;">
                        <div :style="{ width: statsBar(equipoAStats[stat.maxKey], Math.max(equipoAStats[stat.maxKey], equipoBStats[stat.maxKey])), background: '#eab308', height: '100%' }"></div>
                      </div>
                    </div>
                  </td>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); text-align:center; font-weight:bold; color:#eab308;">
                    {{ equipoBStats ? equipoBStats[stat.key] ?? '-' : '-' }}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); color:var(--text);">📊 Diferencia</td>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); text-align:center; font-weight:bold; color:#eab308;">
                    {{ (equipoAStats?.gf || 0) - (equipoAStats?.gc || 0) }}
                  </td>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); text-align:center;"></td>
                  <td style="padding:10px 8px; border-bottom:1px solid var(--border); text-align:center; font-weight:bold; color:#eab308;">
                    {{ (equipoBStats?.gf || 0) - (equipoBStats?.gc || 0) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="box" style="margin-top:12px;">
            <h4 style="color:#eab308; margin-bottom:12px;">⚔️ Enfrentamientos Directos</h4>
            <div v-if="h2hEquipos.length === 0" style="color:var(--text-muted); text-align:center; padding:10px;">
              No se enfrentaron en el torneo actual
            </div>
            <div v-else class="overflow-table">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="text-align:left; padding:6px; border-bottom:1px solid var(--border); color:var(--text-muted);">Fecha</th>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid var(--border); color:var(--text-muted);">Partido</th>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid var(--border); color:var(--text-muted);">Resultado</th>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid var(--border); color:var(--text-muted);">Ganador</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(m, i) in h2hEquipos" :key="i" style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px 6px; font-size:0.85rem;">{{ m.fecha }}</td>
                    <td style="padding:8px 6px; text-align:center; font-size:0.85rem;">{{ m.local }} vs {{ m.visitante }}</td>
                    <td style="padding:8px 6px; text-align:center; font-weight:bold; color:#eab308;">
                      {{ m.goles_local }} - {{ m.goles_visitante }}
                    </td>
                    <td style="padding:8px 6px; text-align:center;">
                      <span v-if="m.ganador === 'A'" style="color:#22c55e; font-weight:bold;">{{ equipoA.nombre }}</span>
                      <span v-else-if="m.ganador === 'B'" style="color:#22c55e; font-weight:bold;">{{ equipoB.nombre }}</span>
                      <span v-else style="color:var(--text-muted);">🤝 Empate</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </template>
  </section>
</template>
