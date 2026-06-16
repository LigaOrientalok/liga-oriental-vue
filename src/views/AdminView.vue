<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useTorneoStore } from '../stores/torneoStore'
import { useToastStore } from '../stores/toastStore'
import { db } from '../lib/db'
import { calcularRating } from '../lib/playerStats'
import { useConfigStore } from '../stores/configStore'

const auth = useAuthStore()
const torneo = useTorneoStore()
const toast = useToastStore()

const activeTab = ref('usuarios')

const usuarios = ref([])
const equipos = ref([])
const jugadores = ref([])
const configStore = useConfigStore()
const loading = ref(false)
const saving = ref(false)

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%2330363d' width='150' height='150'/%3E%3Ctext fill='%238b949e' font-family='sans-serif' font-size='14' text-anchor='middle' x='75' y='85'%3ESin Foto%3C/text%3E%3C/svg%3E"

const modalConfirm = ref(null)
const modalPrompt = ref(null)
const modalInput = ref('')
const modalInput2 = ref('')

function waitConfirm(msg) {
  return new Promise(resolve => {
    modalConfirm.value = { message: msg, resolve }
  })
}

function waitPrompt(label1, val1, label2, val2) {
  return new Promise(resolve => {
    modalInput.value = val1 || ''
    modalInput2.value = val2 || ''
    modalPrompt.value = { label1, label2, resolve }
  })
}

function onConfirm(ok) {
  if (modalConfirm.value) {
    modalConfirm.value.resolve(ok)
    modalConfirm.value = null
  }
}

function onPromptOk() {
  if (modalPrompt.value) {
    modalPrompt.value.resolve([modalInput.value, modalInput2.value])
    modalPrompt.value = null
  }
}

function onPromptCancel() {
  if (modalPrompt.value) {
    modalPrompt.value.resolve(null)
    modalPrompt.value = null
  }
}

const totalUsuarios = computed(() => usuarios.value.length)
const aprobados = computed(() => usuarios.value.filter(u => u.estado === 'aprobado').length)
const pendientes = computed(() => usuarios.value.filter(u => u.estado === 'pendiente').length)

const tabs = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'equipos', label: 'Equipos' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'sanciones', label: 'Sanciones' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'torneos', label: 'Torneos' },
  { id: 'config', label: 'Configuración' },
]

async function soloAdmin() {
  const { data } = await supabase.from('usuarios').select('rol').eq('id', auth.user?.id).maybeSingle()
  if (data?.rol !== 'admin') throw new Error('Acceso denegado: se requiere admin')
}

async function cargarUsuarios() {
  try {
    await soloAdmin()
    loading.value = true
    const { data, error } = await supabase.from('usuarios').select('*').order('fecha_registro', { ascending: false })
    if (error) throw error
    usuarios.value = data || []
    await cargarEquipos()
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

async function cambiarRol(usuarioId, nuevoRol, equipoIdVal) {
  try {
    await soloAdmin()
    const updates = { rol: nuevoRol }
    if (nuevoRol === 'delegado') {
      updates.equipo_id = equipoIdVal || null
    } else {
      updates.equipo_id = null
    }
    const { error } = await supabase.from('usuarios').update(updates).eq('id', usuarioId)
    if (error) throw error
    toast.success('✅ Rol actualizado')
    await cargarUsuarios()
  } catch (e) {
    toast.error('Error al cambiar rol')
  }
}

const delegadoEquipoSel = ref({})

function onRolChange(u, nuevoRol) {
  if (nuevoRol === 'delegado' && !delegadoEquipoSel.value[u.id]) {
    toast.warning('Seleccioná un equipo para el delegado')
  }
  cambiarRol(u.id, nuevoRol, delegadoEquipoSel.value[u.id] || null)
}

async function cambiarEstado(usuarioId, nuevoEstado) {
  try {
    await soloAdmin()
    const actualizacion = {
      estado: nuevoEstado,
      fecha_aprobacion: nuevoEstado === 'aprobado' ? new Date().toISOString() : null,
      aprobado_por: auth.user?.id
    }
    const { error } = await supabase.from('usuarios').update(actualizacion).eq('id', usuarioId)
    if (error) throw error
    toast.success('✅ Estado actualizado')
    await cargarUsuarios()
  } catch (e) {
    toast.error('Error al cambiar estado')
  }
}

async function eliminarUsuario(usuarioId, email) {
  if (!await waitConfirm(`¿Eliminar usuario ${email}?`)) return
  try {
    await soloAdmin()
    const { error } = await supabase.rpc('eliminar_usuario_auth', { user_id: usuarioId })
    if (error) throw error
    toast.success('✅ Usuario eliminado (auth + público)')
    await cargarUsuarios()
  } catch (e) {
    toast.error('Error al eliminar usuario: ' + e.message)
  }
}

// Sanciones
const sanciones = ref([])
const loadingSanciones = ref(false)
const sancionJugadorId = ref('')
const sancionMotivo = ref('')
const sancionTipo = ref('suspension')
const sancionFechaInicio = ref('')
const sancionFechaFin = ref('')

const sancionJugadores = computed(() => {
  return jugadores.value.filter(j => {
    const yaSancionado = sanciones.value.some(s => s.jugador_id === j.id && s.activa)
    return !yaSancionado
  })
})

function getNombreJugador(id) {
  const j = jugadores.value.find(x => x.id === id)
  return j?.nombre || 'Desconocido'
}

async function cargarSanciones() {
  if (!torneo.torneoActual) return
  loadingSanciones.value = true
  try {
    sanciones.value = await db.getSanciones(torneo.torneoActual)
    await cargarEquipos()
  } finally {
    loadingSanciones.value = false
  }
}

async function guardarSancion() {
  if (!torneo.torneoActual) return toast.error('Seleccioná un torneo')
  if (!sancionJugadorId.value || !sancionMotivo.value.trim()) return toast.error('Completá jugador y motivo')
  saving.value = true
  try {
    await db.createSancion(
      torneo.torneoActual,
      parseInt(sancionJugadorId.value),
      sancionMotivo.value.trim(),
      sancionTipo.value,
      sancionFechaInicio.value || null,
      sancionFechaFin.value || null
    )
    toast.success('✅ Sanción creada')
    sancionJugadorId.value = ''
    sancionMotivo.value = ''
    sancionTipo.value = 'suspension'
    sancionFechaInicio.value = ''
    sancionFechaFin.value = ''
    await cargarSanciones()
  } catch (e) {
    toast.error('Error al crear sanción')
  } finally {
    saving.value = false
  }
}

async function toggleSancion(id, activa) {
  try {
    await db.updateSancion(id, { activa })
    toast.success(activa ? '✅ Sanción reactivada' : '✅ Sanción cumplida')
    await cargarSanciones()
  } catch (e) {
    toast.error('Error al actualizar sanción')
  }
}

async function eliminarSancion(id) {
  if (!await waitConfirm('¿Eliminar esta sanción?')) return
  try {
    await db.deleteSancion(id)
    toast.success('🗑️ Sanción eliminada')
    await cargarSanciones()
  } catch (e) {
    toast.error('Error al eliminar sanción')
  }
}

// Pagos
const pagos = ref([])
const loadingPagos = ref(false)
const pagoConcepto = ref('')
const pagoMonto = ref(0)
const pagoUsuarioId = ref('')
const pagoEquipoId = ref('')

async function cargarPagos() {
  if (!torneo.torneoActual) return
  loadingPagos.value = true
  try {
    pagos.value = await db.getPagos(torneo.torneoActual)
  } finally {
    loadingPagos.value = false
  }
}

async function crearPagoAdmin() {
  if (!torneo.torneoActual) return toast.error('Seleccioná un torneo')
  if (!pagoConcepto.value.trim() || !pagoMonto.value || pagoMonto.value <= 0) return toast.error('Completá concepto y monto')
  if (!pagoUsuarioId.value) return toast.error('Seleccioná un usuario')
  saving.value = true
  try {
    const pago = await db.createPago(
      torneo.torneoActual,
      pagoUsuarioId.value,
      pagoEquipoId.value || null,
      pagoConcepto.value.trim(),
      pagoMonto.value
    )
    if (pago) {
      toast.success('✅ Pago registrado')
      pagoConcepto.value = ''
      pagoMonto.value = 0
      pagoUsuarioId.value = ''
      pagoEquipoId.value = ''
      await cargarPagos()
    }
  } catch (e) {
    toast.error('Error al crear pago')
  } finally {
    saving.value = false
  }
}

async function togglePagoEstado(pagoId, estadoActual) {
  try {
    const nuevoEstado = estadoActual === 'pendiente' ? 'pagado' : 'pendiente'
    const updates = { estado: nuevoEstado }
    if (nuevoEstado === 'pagado') updates.fecha_pago = new Date().toISOString()
    await db.updatePago(pagoId, updates)
    toast.success( nuevoEstado === 'pagado' ? '✅ Pago marcado como pagado' : '🔄 Pago revertido')
    await cargarPagos()
  } catch (e) {
    toast.error('Error al actualizar pago')
  }
}

async function eliminarPagoAdmin(id) {
  if (!await waitConfirm('¿Eliminar este pago?')) return
  try {
    await db.deletePago(id)
    toast.success('🗑️ Pago eliminado')
    await cargarPagos()
  } catch (e) {
    toast.error('Error al eliminar pago')
  }
}

function getNombreUsuario(id) {
  const u = usuarios.value.find(x => x.id === id)
  return u?.email || 'Desconocido'
}

// Team management
const newTeamName = ref('')
const newTeamDia = ref('Lunes')
const newTeamLogo = ref(null)

async function cargarEquipos() {
  if (!torneo.torneoActual) return
  loading.value = true
  try {
    equipos.value = await db.getEquipos(torneo.torneoActual)
    jugadores.value = await db.getJugadores(torneo.torneoActual)
  } finally {
    loading.value = false
  }
}

function comprimirImagen(base64, maxWidth = 150) {
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

async function guardarEquipo() {
  if (!torneo.torneoActual) return toast.error('Selecciona un torneo')
  const nom = newTeamName.value.trim()
  const fileInput = newTeamLogo.value
  if (!nom || !fileInput) return toast.error('Completá nombre y logo')

  saving.value = true
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const logo = await comprimirImagen(e.target.result)
        const eq = await db.createEquipo(torneo.torneoActual, nom, newTeamDia.value, logo)
        if (eq) {
          toast.success('✅ Equipo creado')
          newTeamName.value = ''
          newTeamDia.value = 'Lunes'
          newTeamLogo.value = null
          await cargarEquipos()
        }
      } catch { toast.error('Error al comprimir imagen') }
      saving.value = false
    }
    reader.onerror = () => { saving.value = false; toast.error('Error al leer la imagen') }
    reader.readAsDataURL(fileInput)
  } catch (e) {
    saving.value = false
    toast.error('Error al crear equipo')
  }
}

async function editarEquipo(eq) {
  const vals = await waitPrompt('Nombre:', eq.nombre, 'Día:', eq.dia_semana)
  if (!vals) return
  const [nom, dia] = vals
  if (!nom || !nom.trim() || !dia) return

  saving.value = true
  try {
    await db.updateEquipo(eq.id, { nombre: nom.trim(), dia_semana: dia })
    toast.success('✅ Equipo actualizado')
    await cargarEquipos()
  } catch (e) {
    toast.error('Error al actualizar equipo')
  } finally {
    saving.value = false
  }
}

async function eliminarEquipoAdmin(id) {
  if (!await waitConfirm('¿Eliminar este equipo?')) return
  try {
    await db.deleteEquipo(id)
    toast.success('🗑️ Eliminado')
    await cargarEquipos()
  } catch (e) {
    toast.error('Error al eliminar equipo')
  }
}

function getJugadoresEquipo(equipoId) {
  return jugadores.value.filter(j => j.equipos?.includes(equipoId))
}

// Player management
async function eliminarJugadorAdmin(j) {
  if (!await waitConfirm(`¿Eliminar a ${j.nombre}?`)) return
  try {
    await supabase.from('jugador_equipo').delete().eq('jugador_id', j.id)
    await db.deleteJugador(j.id)
    toast.success('🗑️ Jugador eliminado')
    await cargarEquipos()
  } catch (e) {
    toast.error('Error al eliminar jugador')
  }
}

function getEquiposNombres(j) {
  return j.equipos?.map(eId => {
    const eq = equipos.value.find(e => e.id === eId)
    return eq ? eq.nombre : ''
  }).filter(Boolean).join(', ') || '-'
}

// Torneo management
const newTorneoNombre = ref('')
const newTorneoDesc = ref('')

// Config state
const configTitulo = ref(configStore.titulo)
const configLogoFile = ref(null)
const configLogoPreview = ref(configStore.logo_url)
const configColorPrimario = ref(configStore.color_primario)
const configColorSecundario = ref(configStore.color_secundario)
const configFondoOscuro = ref(configStore.fondo_oscuro)
const configFondoClaro = ref(configStore.fondo_claro)
const configSaving = ref(false)

async function cargarConfig() {
  configTitulo.value = configStore.titulo
  configLogoPreview.value = configStore.logo_url
  configColorPrimario.value = configStore.color_primario
  configColorSecundario.value = configStore.color_secundario
  configFondoOscuro.value = configStore.fondo_oscuro
  configFondoClaro.value = configStore.fondo_claro
}

async function guardarConfig() {
  configSaving.value = true
  try {
    let logo_url = configStore.logo_url
    if (configLogoFile.value) {
      const reader = new FileReader()
      logo_url = await new Promise((resolve, reject) => {
        reader.onload = async (e) => {
          try {
            const compressed = await comprimirImagen(e.target.result, 300)
            resolve(compressed)
          } catch { reject(new Error('Error al comprimir imagen')) }
        }
        reader.onerror = reject
        reader.readAsDataURL(configLogoFile.value)
      })
    }
    const ok = await configStore.saveConfig({
      titulo: configTitulo.value.trim() || 'Liga Oriental',
      logo_url,
      color_primario: configColorPrimario.value,
      color_secundario: configColorSecundario.value,
      fondo_oscuro: configFondoOscuro.value,
      fondo_claro: configFondoClaro.value
    })
    if (ok) {
      toast.success('✅ Configuración guardada')
      configLogoFile.value = null
      configLogoPreview.value = logo_url
    } else {
      toast.error('Error al guardar configuración')
    }
  } catch (e) {
    toast.error('Error al guardar configuración')
  } finally {
    configSaving.value = false
  }
}

async function crearTorneo() {
  if (!newTorneoNombre.value.trim()) return toast.error('El nombre es obligatorio')
  saving.value = true
  try {
    const ok = await torneo.crearTorneo(newTorneoNombre.value.trim(), newTorneoDesc.value.trim())
    if (ok) {
      newTorneoNombre.value = ''
      newTorneoDesc.value = ''
    }
  } finally {
    saving.value = false
  }
}

async function eliminarTorneo(id) {
  if (!await waitConfirm('¿Eliminar este torneo y todos sus datos?')) return
  try {
    await db.deleteTorneo(id)
    toast.success('🗑️ Torneo eliminado')
    await torneo.init()
  } catch (e) {
    toast.error('Error al eliminar torneo')
  }
}

onMounted(async () => {
  await cargarUsuarios()
  if (torneo.torneoActual) {
    await cargarEquipos()
    await cargarSanciones()
    await cargarPagos()
  }
})

watch(() => torneo.torneoActual, async () => {
  if (torneo.torneoActual) {
    await cargarEquipos()
    await cargarSanciones()
    await cargarPagos()
  }
})
</script>

<template>
  <section>
    <div class="box">
      <h3>Panel ADMIN 🔐</h3>
      <p style="color:#22c55e;">✅ Sesión iniciada como <strong>{{ auth.user?.email }}</strong></p>

      <div style="display:flex; gap:10px; margin-top:15px; flex-wrap:wrap; border-bottom:2px solid var(--border); padding-bottom:10px;">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="btn-mini"
          :style="{ background: activeTab === tab.id ? '#eab308' : 'var(--border)', color: activeTab === tab.id ? 'black' : 'white' }"
          @click="activeTab = tab.id; if(tab.id === 'usuarios') cargarUsuarios(); if((tab.id === 'equipos' || tab.id === 'jugadores') && torneo.torneoActual) cargarEquipos(); if(tab.id === 'sanciones' && torneo.torneoActual) cargarSanciones(); if(tab.id === 'config') cargarConfig()"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- USERS TAB -->
      <div v-if="activeTab === 'usuarios'" style="margin-top:15px;">
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:15px;">
          <div class="box" style="text-align:center; padding:10px;">
            <h3 style="color:#3b82f6; font-size:1.3rem; margin:0;">{{ totalUsuarios }}</h3>
            <p style="color:var(--text-accent); margin:5px 0 0; font-size:0.8rem;">Total</p>
          </div>
          <div class="box" style="text-align:center; padding:10px;">
            <h3 style="color:#22c55e; font-size:1.3rem; margin:0;">{{ aprobados }}</h3>
            <p style="color:var(--text-accent); margin:5px 0 0; font-size:0.8rem;">Aprobados</p>
          </div>
          <div class="box" style="text-align:center; padding:10px;">
            <h3 style="color:#f97316; font-size:1.3rem; margin:0;">{{ pendientes }}</h3>
            <p style="color:var(--text-accent); margin:5px 0 0; font-size:0.8rem;">Pendientes</p>
          </div>
        </div>

        <div v-if="loading" style="text-align:center; padding:20px; color:var(--text-accent);">Cargando usuarios...</div>

        <div v-else style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
            <thead>
              <tr style="background:var(--border);">
                <th style="padding:8px; color:#eab308; text-align:left;">Email</th>
                <th style="padding:8px; color:#eab308; text-align:center;">Rol</th>
                <th style="padding:8px; color:#eab308; text-align:center;">Estado</th>
                <th style="padding:8px; color:#eab308; text-align:center;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in usuarios" :key="u.id" style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;">
                  <div>{{ u.email }}</div>
                  <div v-if="u.rol === 'delegado'" style="font-size:0.75rem; color:#8b5cf6; margin-top:2px;">
                    🏷️ {{ equipos.find(e => e.id === u.equipo_id)?.nombre || 'Sin equipo' }}
                  </div>
                </td>
                <td style="padding:8px; text-align:center;">
                  <div>
                    <select
                      :value="u.rol"
                      @change="onRolChange(u, $event.target.value)"
                      style="padding:4px; background:var(--bg-input); color:white; border:1px solid var(--border); border-radius:4px; font-size:0.8rem;"
                    >
                      <option value="usuario">Usuario</option>
                      <option value="arbitro">Árbitro</option>
                      <option value="delegado">Delegado</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select
                      v-if="u.rol === 'delegado'"
                      :value="u.equipo_id"
                      @change="cambiarRol(u.id, 'delegado', $event.target.value || null)"
                      style="margin-top:4px; padding:4px; background:var(--bg-input); color:white; border:1px solid var(--border); border-radius:4px; font-size:0.75rem; width:100%;"
                    >
                      <option value="">Sin equipo</option>
                      <option v-for="eq in equipos" :key="eq.id" :value="eq.id">{{ eq.nombre }}</option>
                    </select>
                  </div>
                </td>
                <td style="padding:8px; text-align:center;">
                  <select
                    :value="u.estado"
                    @change="cambiarEstado(u.id, $event.target.value)"
                    style="padding:4px; background:var(--bg-input); color:white; border:1px solid var(--border); border-radius:4px; font-size:0.8rem;"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </td>
                <td style="padding:8px; text-align:center;">
                  <button
                    @click="eliminarUsuario(u.id, u.email)"
                    style="background:#ef4444; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem;"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TEAMS TAB -->
      <div v-if="activeTab === 'equipos'" style="margin-top:15px;">
        <div v-if="!torneo.torneoActual" style="color:#f97316; padding:10px;">
          Seleccioná un torneo primero
        </div>
        <div v-else style="display:grid; grid-template-columns: 1fr 2fr; gap:20px;">
          <div class="box">
            <h3 style="color:#eab308; margin-bottom:15px;">➕ Nuevo Equipo</h3>
            <label class="label-accent">Nombre:</label>
            <input type="text" v-model="newTeamName" placeholder="Nombre del equipo" />
            <label class="label-accent">Día:</label>
            <select v-model="newTeamDia">
              <option>Lunes</option>
              <option value="Miercoles">Miércoles</option>
              <option>Jueves</option>
              <option>Viernes</option>
              <option value="Sabado">Sábado</option>
              <option>Domingo</option>
            </select>
            <label class="label-accent">Logo:</label>
            <input type="file" accept="image/*" @change="e => newTeamLogo = e.target.files[0]" />
            <button class="btn-main" @click="guardarEquipo" :disabled="saving" style="width:100%;">
              {{ saving ? '⏳ Creando...' : '✅ CREAR EQUIPO' }}
            </button>
          </div>

          <div class="box">
            <h3 style="color:#eab308; margin-bottom:15px;">📋 Equipos</h3>
            <div v-if="loading" class="spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
            <div v-else-if="equipos.length === 0" style="color:var(--text-accent);">No hay equipos aún</div>
            <div v-else v-for="eq in equipos" :key="eq.id" style="background:var(--bg-input); border-radius:8px; padding:15px; margin-bottom:10px; border-left:4px solid #eab308;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <img
                  :src="eq.logo || ''"
                  loading="lazy"
                  style="width:36px; height:36px; border-radius:50%; object-fit:cover; background:var(--border);"
                  @error="$event.target.style.display = 'none'"
                />
                <div>
                  <strong style="color:white; font-size:1rem;">{{ eq.nombre }}</strong>
                  <span style="color:var(--text-muted); font-size:0.8rem; display:block;">
                    {{ eq.dia_semana }} | PJ: {{ eq.pj || 0 }} | PTS: {{ eq.pts || 0 }}
                  </span>
                </div>
                <button @click="editarEquipo(eq)" class="btn-mini" style="background:#3b82f6; color:white; padding:4px 8px; font-size:0.7rem;">✏️</button>
                <button @click="eliminarEquipoAdmin(eq.id)" style="margin-left:auto; background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.8rem;">🗑️</button>
              </div>
              <div v-if="getJugadoresEquipo(eq.id).length > 0" style="display:flex; flex-wrap:wrap; gap:5px;">
                <span
                  v-for="j in getJugadoresEquipo(eq.id)"
                  :key="j.id"
                  style="background:var(--border); padding:2px 8px; border-radius:4px; font-size:0.8rem; color:var(--text-accent);"
                >
                  {{ j.nombre }}
                </span>
              </div>
              <p v-else style="color:var(--text-muted); font-size:0.8rem; margin:0;">Sin jugadores</p>
            </div>
          </div>
        </div>
      </div>

      <!-- PLAYERS TAB -->
      <div v-if="activeTab === 'jugadores'" style="margin-top:15px;">
        <div v-if="!torneo.torneoActual" style="color:#f97316; padding:10px;">
          Seleccioná un torneo primero
        </div>
        <div v-else style="overflow-x:auto;">
          <h3 style="color:#eab308; margin-bottom:15px;">
            📋 Gestión de Jugadores ({{ jugadores.length }})
          </h3>
          <div v-if="loading" class="spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
          <div v-else-if="jugadores.length === 0" style="color:var(--text-muted);">No hay jugadores registrados</div>
          <table v-else style="width:100%; border-collapse:collapse; font-size:0.85rem;">
            <thead>
              <tr style="background:var(--border);">
                <th style="padding:8px; color:#eab308;">Foto</th>
                <th style="padding:8px; color:#eab308; text-align:left;">Nombre</th>
                <th style="padding:8px; color:#eab308;">Pos</th>
                <th style="padding:8px; color:#eab308;">Equipo(s)</th>
                <th style="padding:8px; color:#eab308;">⚽</th>
                <th style="padding:8px; color:#eab308;">⭐</th>
                <th style="padding:8px; color:#eab308;">🏃</th>
                <th style="padding:8px; color:#eab308;">Rating</th>
                <th style="padding:8px; color:#eab308;">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in jugadores" :key="j.id" style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;">
                  <img :src="j.foto || DEFAULT_AVATAR" loading="lazy" style="width:30px;height:30px;border-radius:50%;object-fit:cover;" />
                </td>
                <td style="padding:8px; text-align:left;">
                  <span style="color:white;">{{ j.nombre }}</span>
                </td>
                <td style="padding:8px;">{{ j.posicion || '-' }}</td>
                <td style="padding:8px; font-size:0.75rem;">{{ getEquiposNombres(j) }}</td>
                <td style="padding:8px;">{{ j.goles || 0 }}</td>
                <td style="padding:8px;">{{ j.mvps || 0 }}</td>
                <td style="padding:8px;">{{ j.pj || 0 }}</td>
                <td style="padding:8px; font-weight:bold; color:#eab308;">{{ calcularRating(j) }}</td>
                <td style="padding:8px;">
                  <button @click="eliminarJugadorAdmin(j)" class="btn-mini" style="background:#ef4444; color:white; padding:4px 8px; font-size:0.7rem;">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SANCIONES TAB -->
      <div v-if="activeTab === 'sanciones'" style="margin-top:15px;">
        <div v-if="!torneo.torneoActual" style="color:#f97316; padding:10px;">
          Seleccioná un torneo primero
        </div>
        <div v-else style="display:grid; grid-template-columns: 1fr 2fr; gap:20px;">
          <div class="box">
            <h3 style="color:#eab308; margin-bottom:15px;">➕ Nueva Sanción</h3>
            <label class="label-accent">Jugador:</label>
            <select v-model="sancionJugadorId" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option value="">Seleccionar...</option>
              <option v-for="j in sancionJugadores" :key="j.id" :value="j.id">{{ j.nombre }}</option>
            </select>
            <label class="label-accent">Motivo:</label>
            <input v-model="sancionMotivo" type="text" placeholder="Ej: Agresión, acumulación de tarjetas" />
            <label class="label-accent">Tipo:</label>
            <select v-model="sancionTipo" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option value="suspension">Suspensión</option>
              <option value="amonestacion">Amonestación</option>
            </select>
            <label class="label-accent">Fecha inicio:</label>
            <input v-model="sancionFechaInicio" type="date" />
            <label class="label-accent">Fecha fin:</label>
            <input v-model="sancionFechaFin" type="date" />
            <button class="btn-main" @click="guardarSancion" :disabled="saving">
              {{ saving ? '⏳ Guardando...' : '✅ CREAR SANCIÓN' }}
            </button>
          </div>

          <div class="box">
            <h3 style="color:#eab308; margin-bottom:15px;">
              📋 Sanciones ({{ sanciones.length }})
            </h3>
            <div v-if="loadingSanciones" class="spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
            <div v-else-if="sanciones.length === 0" style="color:var(--text-muted); text-align:center; padding:20px;">No hay sanciones</div>
            <div v-else v-for="s in sanciones" :key="s.id" style="background:var(--bg-input); border-radius:8px; padding:12px; margin-bottom:8px; border-left:4px solid;" :style="{ borderLeftColor: s.tipo === 'suspension' ? '#ef4444' : '#f97316' }">
              <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                  <strong style="color:white;">{{ getNombreJugador(s.jugador_id) }}</strong>
                  <span
                    style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:600; text-transform:uppercase;"
                    :style="{ background: s.tipo === 'suspension' ? '#ef4444' : '#f97316', color: 'white' }"
                  >{{ s.tipo === 'suspension' ? '🔴 Suspendido' : '🟡 Amonestado' }}</span>
                  <span v-if="!s.activa" style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:4px; font-size:0.7rem; background:#22c55e; color:white;">✓ Cumplida</span>
                </div>
                <div style="display:flex; gap:5px;">
                  <button v-if="s.activa" @click="toggleSancion(s.id, false)" class="btn-mini" style="background:#22c55e; color:white; padding:4px 8px; font-size:0.65rem;">✓</button>
                  <button @click="eliminarSancion(s.id)" class="btn-mini" style="background:#ef4444; color:white; padding:4px 8px; font-size:0.65rem;">🗑️</button>
                </div>
              </div>
              <p style="margin:6px 0 0; color:var(--text-accent); font-size:0.85rem;">{{ s.motivo }}</p>
              <div style="margin-top:4px; font-size:0.75rem; color:var(--text-muted);">
                {{ s.fecha_inicio ? new Date(s.fecha_inicio).toLocaleDateString('es-ES') : '-' }} → {{ s.fecha_fin ? new Date(s.fecha_fin).toLocaleDateString('es-ES') : 'indefinido' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PAGOS TAB -->
      <div v-if="activeTab === 'pagos'" style="margin-top:15px;">
        <div v-if="!torneo.torneoActual" style="color:#f97316; padding:10px;">
          Seleccioná un torneo primero
        </div>
        <div v-else style="display:grid; grid-template-columns: 1fr 2fr; gap:20px;">
          <div class="box" style="border-left:4px solid #8b5cf6;">
            <h3 style="color:#8b5cf6; margin-bottom:15px;">💰 Nuevo Pago</h3>
            <label class="label-accent">Usuario:</label>
            <select v-model="pagoUsuarioId" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option value="">Seleccionar...</option>
              <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.email }}</option>
            </select>
            <label class="label-accent">Equipo (opcional):</label>
            <select v-model="pagoEquipoId" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option value="">Sin equipo</option>
              <option v-for="eq in equipos" :key="eq.id" :value="eq.id">{{ eq.nombre }}</option>
            </select>
            <label class="label-accent">Concepto:</label>
            <select v-model="pagoConcepto" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
              <option value="">Seleccionar...</option>
              <option value="Cuota mensual">Cuota mensual</option>
              <option value="Inscripción">Inscripción</option>
              <option value="Multa">Multa</option>
              <option value="Fondo de equipo">Fondo de equipo</option>
            </select>
            <label class="label-accent">Monto ($):</label>
            <input type="number" v-model.number="pagoMonto" min="1" placeholder="Ej: 5000" />
            <button class="btn-main" @click="crearPagoAdmin" :disabled="saving" style="background:#8b5cf6; color:white;">
              {{ saving ? '⏳ Guardando...' : '✅ REGISTRAR PAGO' }}
            </button>
          </div>

          <div class="box">
            <h3 style="color:#eab308; margin-bottom:15px;">
              📋 Historial de Pagos ({{ pagos.length }})
            </h3>
            <div v-if="loadingPagos" class="spinner"><div class="spinner-ring"></div><span>Cargando...</span></div>
            <div v-else-if="pagos.length === 0" style="color:var(--text-muted); text-align:center; padding:20px;">No hay pagos registrados</div>
            <div v-else v-for="p in pagos" :key="p.id"
              style="background:var(--bg-input); border-radius:8px; padding:12px; margin-bottom:8px; border-left:4px solid;"
              :style="{ borderLeftColor: p.estado === 'pagado' ? '#22c55e' : p.estado === 'pendiente' ? '#f97316' : '#ef4444' }"
            >
              <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                  <strong style="color:white;">{{ p.concepto }}</strong>
                  <span style="display:block; color:var(--text-muted); font-size:0.75rem;">
                    {{ getNombreUsuario(p.usuario_id) }}
                    <span v-if="p.equipo_id"> | {{ equipos.find(e => e.id === p.equipo_id)?.nombre || '' }}</span>
                  </span>
                  <span style="display:block; color:var(--text-muted); font-size:0.75rem;">
                    {{ new Date(p.fecha_creacion).toLocaleDateString('es-ES') }}
                  </span>
                </div>
                <div style="text-align:right;">
                  <strong style="color:#22c55e; font-size:1.1rem;">${{ Number(p.monto).toLocaleString('es-AR') }}</strong>
                  <div style="display:flex; gap:5px; margin-top:5px;">
                    <button
                      @click="togglePagoEstado(p.id, p.estado)"
                      class="btn-mini"
                      :style="{ background: p.estado === 'pendiente' ? '#22c55e' : '#f97316', color: 'white', padding: '4px 8px', fontSize: '0.65rem' }"
                    >
                      {{ p.estado === 'pendiente' ? '✓ Pagar' : '↩ Revertir' }}
                    </button>
                    <button @click="eliminarPagoAdmin(p.id)" class="btn-mini" style="background:#ef4444; color:white; padding:4px 8px; font-size:0.65rem;">🗑️</button>
                  </div>
                  <span style="display:block; font-size:0.7rem; text-transform:uppercase; margin-top:2px;"
                    :style="{ color: p.estado === 'pagado' ? '#22c55e' : '#f97316' }"
                  >{{ p.estado }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CONFIG TAB -->
      <div v-if="activeTab === 'config'" style="margin-top:15px;">
        <div class="box" style="max-width:550px;">
          <h3 style="color:#eab308; margin-bottom:15px;">⚙️ Configuración General</h3>
          <label class="label-accent">Título de la app:</label>
          <input type="text" v-model="configTitulo" placeholder="Liga Oriental" />

          <label class="label-accent">Logo principal:</label>
          <input type="file" accept="image/*" @change="e => { configLogoFile = e.target.files[0]; configLogoPreview = URL.createObjectURL(e.target.files[0]) }" />
          <div v-if="configLogoPreview" style="margin-top:8px;">
            <img :src="configLogoPreview" style="max-width:120px; max-height:120px; border-radius:8px; border:2px solid var(--border); object-fit:cover;" />
          </div>

          <label class="label-accent" style="margin-top:10px;">Color primario (acento):</label>
          <div style="display:flex; gap:10px; align-items:center;">
            <input type="color" v-model="configColorPrimario" style="width:48px;height:48px;border:none;cursor:pointer;background:none;" />
            <code style="color:var(--text-muted); font-size:0.85rem;">{{ configColorPrimario }}</code>
          </div>

          <label class="label-accent">Color secundario:</label>
          <div style="display:flex; gap:10px; align-items:center;">
            <input type="color" v-model="configColorSecundario" style="width:48px;height:48px;border:none;cursor:pointer;background:none;" />
            <code style="color:var(--text-muted); font-size:0.85rem;">{{ configColorSecundario }}</code>
          </div>

          <label class="label-accent">Fondo modo oscuro:</label>
          <div style="display:flex; gap:10px; align-items:center;">
            <input type="color" v-model="configFondoOscuro" style="width:48px;height:48px;border:none;cursor:pointer;background:none;" />
            <code style="color:var(--text-muted); font-size:0.85rem;">{{ configFondoOscuro }}</code>
          </div>

          <label class="label-accent">Fondo modo claro:</label>
          <div style="display:flex; gap:10px; align-items:center;">
            <input type="color" v-model="configFondoClaro" style="width:48px;height:48px;border:none;cursor:pointer;background:none;" />
            <code style="color:var(--text-muted); font-size:0.85rem;">{{ configFondoClaro }}</code>
          </div>

          <button class="btn-main" @click="guardarConfig" :disabled="configSaving" style="margin-top:15px; width:100%;">
            {{ configSaving ? '⏳ Guardando...' : '💾 GUARDAR CONFIGURACIÓN' }}
          </button>
        </div>
      </div>

      <!-- TORNEOS TAB -->
      <div v-if="activeTab === 'torneos'" style="margin-top:15px;">
        <div class="box" style="max-width:500px; margin-bottom:20px;">
          <h3 style="color:#eab308; margin-bottom:15px;">➕ Nuevo Torneo</h3>
          <label class="label-accent">Nombre:</label>
          <input type="text" v-model="newTorneoNombre" placeholder="Nombre del torneo" />
          <label class="label-accent">Descripción:</label>
          <input type="text" v-model="newTorneoDesc" placeholder="Opcional" />
          <button class="btn-main" @click="crearTorneo" :disabled="saving">
            {{ saving ? '⏳ Creando...' : 'Crear Torneo' }}
          </button>
        </div>

        <div class="box">
          <h3 style="color:#eab308; margin-bottom:15px;">📋 Torneos Existentes</h3>
          <div v-for="t in torneo.torneos" :key="t.id" style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-input); padding:12px; border-radius:8px; margin-bottom:8px;">
            <span style="color:white;">{{ t.nombre }}</span>
            <button @click="eliminarTorneo(t.id)" class="btn-mini" style="background:#ef4444; color:white;">🗑️</button>
          </div>
        </div>
      </div>
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

    <!-- Prompt Modal -->
    <div v-if="modalPrompt" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:9999;" @click.self="onPromptCancel">
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:30px; max-width:400px; width:90%;">
        <label class="label-accent">{{ modalPrompt.label1 }}</label>
        <input v-model="modalInput" type="text" />
        <label class="label-accent">{{ modalPrompt.label2 }}</label>
        <input v-model="modalInput2" type="text" />
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button @click="onPromptOk" class="btn-main" style="flex:1;">OK</button>
          <button @click="onPromptCancel" class="btn-mini" style="background:var(--btn-bg); color:var(--text); padding:14px 20px; flex:1;">Cancelar</button>
        </div>
      </div>
    </div>
  </section>
</template>
