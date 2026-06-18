<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { db } from '../lib/db'
import { useTorneoStore } from '../stores/torneoStore'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'

const torneo = useTorneoStore()
const auth = useAuthStore()
const toast = useToastStore()

const fixture = ref([])
const resultados = ref([])
const equipos = ref([])
const predicciones = ref({})
const ranking = ref([])
const tab = ref('pronosticar')
const loading = ref(true)

const proximosFixture = computed(() => {
  const idsConRes = new Set(resultados.value.map(r => r.fixture_id))
  return fixture.value.filter(f => !idsConRes.has(f.id)).slice(0, 10)
})

const partidosFinalizados = computed(() => {
  return fixture.value.filter(f => resultados.value.some(r => r.fixture_id === f.id && r.estado === 'finalizado'))
})

function getEq(id) { return equipos.value.find(e => e.id === id) }

async function loadData() {
  if (!torneo.torneoActual) return
  loading.value = true
  try {
    const [fx, rs, eqs] = await Promise.all([
      db.getFixture(torneo.torneoActual),
      db.getResultados(torneo.torneoActual),
      db.getEquipos(torneo.torneoActual)
    ])
    fixture.value = fx; resultados.value = rs; equipos.value = eqs
    ranking.value = await db.getRankingPredicciones()
    const preds = {}
    for (const f of fx) {
      const p = await db.getPredicciones(f.id)
      preds[f.id] = p
    }
    predicciones.value = preds
  } finally { loading.value = false }
}

const formData = ref({})

function initForm(fixtureId) {
  if (!formData.value[fixtureId]) formData.value[fixtureId] = { local: 0, visit: 0 }
}

async function guardarPrediccion(fixtureId) {
  const d = formData.value[fixtureId]
  if (!d) return
  if (d.local < 0 || d.visit < 0) return toast.warning('Ingresá números válidos')
  await db.setPrediccion(fixtureId, d.local, d.visit)
  toast.success('✅ Pronóstico guardado')
  const p = await db.getPredicciones(fixtureId)
  predicciones.value[fixtureId] = p
}

watch(() => torneo.torneoActual, async () => { if (torneo.torneoActual) await loadData() })
onMounted(async () => { if (torneo.torneoActual) await loadData() })
</script>

<template>
  <section>
    <div class="box" style="display:flex; gap:10px;">
      <button class="btn-mini" :style="{ background: tab === 'pronosticar' ? '#eab308' : 'var(--border)', color: tab === 'pronosticar' ? 'black' : 'white' }" @click="tab = 'pronosticar'">🔮 Pronosticar</button>
      <button class="btn-mini" :style="{ background: tab === 'ranking' ? '#eab308' : 'var(--border)', color: tab === 'ranking' ? 'black' : 'white' }" @click="tab = 'ranking'">🏆 Ranking</button>
    </div>

    <div v-if="loading" class="box spinner"><div class="spinner-ring"></div></div>

    <template v-else-if="tab === 'pronosticar'">
      <div v-if="proximosFixture.length === 0" class="box" style="text-align:center; padding:30px; color:var(--text-muted);">No hay partidos próximos para pronosticar</div>
      <div v-for="f in proximosFixture" :key="f.id" class="box">
        <h4 style="color:#eab308; margin-bottom:8px;">{{ getEq(f.equipo_local_id)?.nombre }} vs {{ getEq(f.equipo_visitante_id)?.nombre }}</h4>
        <p style="color:var(--text-muted); font-size:0.8rem;">{{ f.fecha }} {{ f.hora }}</p>

        <div v-if="predicciones[f.id]?.mine" style="background:rgba(234,179,8,0.1); border-radius:6px; padding:8px; margin-bottom:8px;">
          <span style="color:var(--text-muted); font-size:0.8rem;">Tu pronóstico: </span>
          <strong style="color:#eab308;">{{ predicciones[f.id].mine.goles_local }} - {{ predicciones[f.id].mine.goles_visitante }}</strong>
          <span v-if="predicciones[f.id].mine.puntos > 0" style="margin-left:8px; color:#22c55e;">(+{{ predicciones[f.id].mine.puntos }} pts)</span>
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <input type="number" min="0" max="20"
            :value="formData[f.id]?.local ?? 0"
            @input="initForm(f.id); formData[f.id].local = parseInt($event.target.value) || 0"
            placeholder="0" style="width:60px; text-align:center;"
/>
          <span style="color:var(--text-muted);">vs</span>
          <input type="number" min="0" max="20"
            :value="formData[f.id]?.visit ?? 0"
            @input="initForm(f.id); formData[f.id].visit = parseInt($event.target.value) || 0"
            placeholder="0" style="width:60px; text-align:center;"
/>
          <button @click="guardarPrediccion(f.id)" class="btn-mini" style="background:#eab308; color:black;">{{ predicciones[f.id]?.mine ? 'Actualizar' : 'Pronosticar' }}</button>
        </div>

        <div v-if="predicciones[f.id]?.all?.length" style="margin-top:8px; font-size:0.75rem; color:var(--text-muted);">
          {{ predicciones[f.id].all.length }} personas pronosticaron
        </div>
      </div>

      <!-- Partidos ya jugados con resultados -->
      <div v-if="partidosFinalizados.length" class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">📋 Pronósticos anteriores</h4>
        <div v-for="f in partidosFinalizados" :key="f.id" style="border-bottom:1px solid var(--border); padding:10px 0;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:white;">{{ getEq(f.equipo_local_id)?.nombre }} vs {{ getEq(f.equipo_visitante_id)?.nombre }}</span>
            <span style="color:#eab308; font-weight:bold;">
              {{ resultados.find(r => r.fixture_id === f.id)?.goles_local }} - {{ resultados.find(r => r.fixture_id === f.id)?.goles_visitante }}
            </span>
          </div>
          <div v-if="predicciones[f.id]?.mine" style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
            Pronosticaste: {{ predicciones[f.id].mine.goles_local }}-{{ predicciones[f.id].mine.goles_visitante }}
            <span v-if="predicciones[f.id].mine.puntos > 0" style="color:#22c55e;">✅ +{{ predicciones[f.id].mine.puntos }} pts</span>
            <span v-else style="color:var(--text-muted);">❌ 0 pts</span>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="tab === 'ranking'">
      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">🏆 Ranking de Pronosticadores</h4>
        <div v-if="ranking.length === 0" style="color:var(--text-muted); text-align:center; padding:20px;">Sin datos</div>
        <div v-for="(r, i) in ranking" :key="r.email" style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border);">
          <strong style="color:var(--text-muted); width:24px;">#{{ i + 1 }}</strong>
          <span style="color:white; flex:1;">{{ r.email }}</span>
          <strong style="color:#eab308;">{{ r.puntos }} pts</strong>
        </div>
      </div>
    </template>
  </section>
</template>
