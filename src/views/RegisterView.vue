<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useTorneoStore } from '../stores/torneoStore'
import { useToastStore } from '../stores/toastStore'
import { db } from '../lib/db'
import { calcularRating } from '../lib/playerStats'

const torneo = useTorneoStore()
const toast = useToastStore()

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%2330363d' width='150' height='150'/%3E%3Ctext fill='%238b949e' font-family='sans-serif' font-size='14' text-anchor='middle' x='75' y='85'%3ESin Foto%3C/text%3E%3C/svg%3E"

const ci = ref('')
const nombre = ref('')
const posicion = ref('DEL')
const pierna = ref('R')
const equipoId = ref('')
const fotoFile = ref(null)
const tempImgJugador = ref(DEFAULT_AVATAR)
const saving = ref(false)
const previewPlayer = ref(null)

function comprimirImagen(base64, maxWidth = 300) {
  return new Promise(resolve => {
    const img = new Image(); img.src = base64
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = maxWidth / img.width
      canvas.width = maxWidth
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
  })
}

let fileReader = null

function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    toast.error('La foto supera los 5MB. Comprimila antes de subir.')
    e.target.value = ''
    return
  }
  fotoFile.value = file
  fileReader = new FileReader()
  fileReader.onload = async (ev) => {
    tempImgJugador.value = await comprimirImagen(ev.target.result)
  }
  fileReader.readAsDataURL(file)
}

const debouncedUpdate = ref(null)

watch(ci, async (newCi) => {
  if (debouncedUpdate.value) clearTimeout(debouncedUpdate.value)
  debouncedUpdate.value = setTimeout(async () => {
    if (!torneo.torneoActual || !newCi) {
      previewPlayer.value = null
      return
    }
    const jugadores = await db.getJugadores(torneo.torneoActual)
    const j = jugadores.find(x => x.ci === newCi)
    previewPlayer.value = j || null
  }, 300)
})

onUnmounted(() => {
  if (fileReader) fileReader.abort()
  if (debouncedUpdate.value) clearTimeout(debouncedUpdate.value)
})

watch(nombre, () => {
  previewPlayer.value = null
})

watch(posicion, () => {
  previewPlayer.value = null
})

watch(pierna, () => {
  previewPlayer.value = null
})

watch(equipoId, () => {
  previewPlayer.value = null
})

async function savePlayer() {
  if (!torneo.torneoActual) return toast.error('Selecciona un torneo')
  const ciVal = ci.value.trim()
  const nomVal = nombre.value.trim().toUpperCase()
  const eqId = parseInt(equipoId.value)
  if (!ciVal || !nomVal || !eqId) return toast.error('Datos incompletos')

  saving.value = true

  try {
    let fotoUrl = tempImgJugador.value
    if (fotoFile.value && fotoUrl !== DEFAULT_AVATAR) {
      const uploaded = await db.uploadFile(fotoFile.value)
      if (uploaded) fotoUrl = uploaded
    }

    const jugadores = await db.getJugadores(torneo.torneoActual)
    const exist = jugadores.find(j => j.ci === ciVal)

    if (exist) {
      const equiposJugador = await db.getEquiposJugador(exist.id)
      if (!equiposJugador.includes(eqId)) {
        await db.vincularJugadorEquipo(exist.id, eqId)
        toast.success('✅ Vinculado')
      } else {
        toast.success('Ya registrado')
      }
    } else {
      const nuevoJugador = await db.createJugador(
        torneo.torneoActual,
        ciVal,
        nomVal,
        posicion.value,
        pierna.value,
        fotoUrl
      )
      if (nuevoJugador) {
        await db.vincularJugadorEquipo(nuevoJugador.id, eqId)
        toast.success('✅ Jugador Creado')
      }
    }
    previewPlayer.value = null
  } catch (e) {
    if (import.meta.env.DEV) console.error('Error al guardar jugador:', e)
    toast.error('Ocurrió un error al guardar. Intentalo de nuevo.')
  } finally {
    saving.value = false
  }
}

const previewName = computed(() => {
  return (nombre.value.toUpperCase() || 'JUGADOR')
})

const previewGoles = computed(() => {
  if (previewPlayer.value) return previewPlayer.value.goles || 0
  return 0
})

const previewPJ = computed(() => {
  if (previewPlayer.value) return previewPlayer.value.pj || 0
  return 0
})

const previewRating = computed(() => {
  if (previewPlayer.value) return calcularRating(previewPlayer.value)
  return 60
})

const equipoLogo = computed(() => {
  if (!equipoId.value) return null
  const eq = torneo.equipos.find(e => e.id === parseInt(equipoId.value))
  return eq?.logo || null
})
</script>

<template>
  <section>
    <div class="registro-container" style="display:flex; gap:20px; flex-wrap:wrap;">
      <div class="box" style="flex:1; min-width:300px;">
        <h2>Registro de Jugador</h2>

        <label class="label-accent">CI del Jugador:</label>
        <input type="text" inputmode="numeric" v-model="ci" placeholder="Cédula de Identidad" />

        <label class="label-accent">Nombre:</label>
        <input type="text" v-model="nombre" placeholder="Nombre completo" />

        <div style="display:flex; gap:10px;">
          <div style="flex:1">
            <label class="label-accent">Posición:</label>
            <select v-model="posicion">
              <option value="POR">Portero</option>
              <option value="DFC">Defensa</option>
              <option value="MC">Mediocampista</option>
              <option value="DEL">Delantero</option>
            </select>
          </div>
          <div style="flex:1">
            <label class="label-accent">Pierna:</label>
            <select v-model="pierna">
              <option value="R">Diestro</option>
              <option value="L">Zurdo</option>
            </select>
          </div>
        </div>

        <label class="label-accent">Equipo:</label>
        <select v-model="equipoId">
          <option disabled value="">Seleccionar...</option>
          <option v-for="eq in torneo.equipos" :key="eq.id" :value="eq.id">{{ eq.nombre }}</option>
        </select>

        <label class="label-accent">Foto:</label>
        <input type="file" accept="image/*" @change="handleFileSelect" />

        <button class="btn-main" @click="savePlayer" :disabled="saving">
          {{ saving ? '⏳ Guardando...' : 'VINCULAR / CREAR FICHA' }}
        </button>
      </div>

      <div class="box" style="flex:0 0 320px; text-align:center;">
        <h3>Vista Previa</h3>
        <div style="background:var(--bg-input); border-radius:12px; padding:20px; margin-top:10px;">
          <img
            :src="tempImgJugador"
            loading="lazy"
            style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:3px solid #eab308; margin-bottom:10px;"
            @error="$event.target.style.display='none'"
          />
          <img
            v-if="equipoLogo"
            :src="equipoLogo"
            loading="lazy"
            style="width:40px; height:40px; border-radius:50%; margin-bottom:5px;"
            @error="$event.target.style.display='none'"
          />
          <h3 style="color:#eab308; margin:5px 0;">{{ previewName }}</h3>
          <div style="display:flex; justify-content:center; gap:10px; margin:5px 0;">
            <span style="background:#3b82f6; padding:2px 10px; border-radius:4px; font-size:0.8rem;">{{ posicion }}</span>
            <span style="background:var(--border); padding:2px 10px; border-radius:4px; font-size:0.8rem;">{{ pierna === 'R' ? 'Diestro' : 'Zurdo' }}</span>
          </div>
          <div style="display:flex; justify-content:center; gap:20px; margin:10px 0; color:var(--text-accent); font-size:0.85rem;">
            <span>⚽ Goles: <b style="color:#22c55e;">{{ previewGoles }}</b></span>
            <span>🏃 PJ: <b style="color:#3b82f6;">{{ previewPJ }}</b></span>
          </div>
          <div style="font-size:1.5rem; font-weight:900; color:#eab308;">
            Rating: <span>{{ previewRating }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
