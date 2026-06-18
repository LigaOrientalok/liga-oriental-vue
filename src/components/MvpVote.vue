<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../lib/db'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import { useTorneoStore } from '../stores/torneoStore'

const props = defineProps({
  resultadoId: { type: Number, required: true },
  teamAId: { type: Number, required: true },
  teamBId: { type: Number, required: true }
})

const auth = useAuthStore()
const toast = useToastStore()
const torneoStore = useTorneoStore()
const jugadores = ref([])
const miVoto = ref(null)
const votos = ref([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const [data, jgs] = await Promise.all([
      db.getMvpVotos(props.resultadoId),
      db.getJugadores(torneoStore.torneoActual)
    ])
    votos.value = data.votos
    miVoto.value = data.miVoto
    jugadores.value = jgs.filter(j => j.equipos?.includes(props.teamAId) || j.equipos?.includes(props.teamBId))
  } finally { loading.value = false }
}

async function votar(jugadorId) {
  if (!auth.isLoggedIn) return toast.warning('Iniciá sesión para votar')
  await db.votarMvp(props.resultadoId, jugadorId)
  toast.success('✅ Voto registrado')
  await load()
}

const conteo = ref(null)
onMounted(async () => {
  await load()
})
</script>

<template>
  <div v-if="loading" style="color:var(--text-muted); font-size:0.8rem;">Cargando...</div>
  <div v-else-if="miVoto" style="color:#22c55e; font-size:0.8rem;">
    ✅ Votaste a <strong>{{ jugadores.find(j => j.id === miVoto.jugador_id)?.nombre || '...' }}</strong>
    <span style="margin-left:8px; color:var(--text-muted);">({{ votos.length }} voto{{ votos.length !== 1 ? 's' : '' }})</span>
  </div>
  <div v-else-if="auth.isLoggedIn" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
    <span style="color:var(--text-muted); font-size:0.75rem;">MVP:</span>
    <select v-model="conteo" @change="conteo && votar(conteo)" style="padding:4px; border-radius:4px; background:var(--bg-input); color:white; border:1px solid var(--border); font-size:0.8rem;">
      <option :value="null">Seleccionar...</option>
      <option v-for="j in jugadores" :key="j.id" :value="j.id">{{ j.nombre }}</option>
    </select>
  </div>
  <div v-else style="color:var(--text-muted); font-size:0.75rem;">Iniciá sesión para votar MVP</div>
</template>
