<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './stores/authStore'
import { useTorneoStore } from './stores/torneoStore'
import { useThemeStore } from './stores/themeStore'
import { useConfigStore } from './stores/configStore'
import LoginForm from './components/LoginForm.vue'
import IntroOverlay from './components/IntroOverlay.vue'
import SponsorBanner from './components/SponsorBanner.vue'
import { exportarJSON, exportarCSV, exportarPDF, respaldarDatos, recomputarEstadisticas, restaurarRespaldo } from './lib/export'
import { db } from './lib/db'
import { pedirPermisoNotificaciones } from './lib/notifications'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const torneo = useTorneoStore()
const themeStore = useThemeStore()
const config = useConfigStore()

const navOpen = ref(false)

const navItems = [
  { path: '/', label: 'INICIO', icon: '🏠' },
  { path: '/registro', label: 'REGISTRO', icon: '📝' },
  { path: '/tablas', label: 'TABLAS', icon: '📊' },
  { path: '/fixture', label: 'FIXTURE', icon: '📅' },
  { path: '/stats', label: 'STATS', icon: '📈' },
  { path: '/fama', label: 'FAMA', icon: '🏆' },
  { path: '/jugadores', label: 'JUGADORES', icon: '🔍' },
  { path: '/equipos', label: 'EQUIPOS', icon: '📋' },
  { path: '/historial', label: 'HISTORIAL', icon: '📜' },
  { path: '/misiones', label: 'MISIONES', icon: '🎯' },
  { path: '/live', label: 'LIVE', icon: '📺' },
  { path: '/comparar', label: 'VS', icon: '⚔️' },
  { path: '/ranking', label: 'RANKING', icon: '📈' },
  { path: '/feed', label: 'ACTIVIDAD', icon: '📰' },
  { path: '/predicciones', label: 'PRONÓSTICOS', icon: '🔮' },
  { path: '/delegado', label: 'DELEGADO', icon: '👔' },
  { path: '/admin', label: 'ADMIN', icon: '⚙️' }
]

const visibleNavItems = computed(() => {
  if (auth.isAdmin) return navItems
  if (auth.isDelegado) return navItems.filter(n => !['/admin'].includes(n.path))
  if (auth.isArbitro) return navItems.filter(n => n.path !== '/admin')
  return navItems.filter(n => !['/admin'].includes(n.path))
})

function navigate(path) {
  navOpen.value = false
  router.push(path)
}

function isActive(path) {
  return route.path === path
}

const notifCount = ref(0)
const notifList = ref([])
const showNotifDropdown = ref(false)
let notifInterval = null
let notifDropdownCleanup = null

async function loadNotifCount() {
  if (!auth.isLoggedIn) return
  try { notifCount.value = await db.notifCount() } catch { notifCount.value = 0 }
}

async function loadNotifList() {
  if (!auth.isLoggedIn) return
  try { notifList.value = await db.getNotificaciones() } catch { notifList.value = [] }
}

async function toggleNotifDropdown() {
  showNotifDropdown.value = !showNotifDropdown.value
  if (showNotifDropdown.value) await loadNotifList()
}

async function marcarLeida(id) {
  await db.marcarLeida(id)
  notifList.value = notifList.value.map(n => n.id === id ? { ...n, leida: true } : n)
  const stillUnread = notifList.value.filter(n => !n.leida).length
  if (stillUnread === 0) notifCount.value = 0
}

async function marcarTodasLeidas() {
  await db.marcarTodasLeidas()
  notifList.value = notifList.value.map(n => ({ ...n, leida: true }))
  notifCount.value = 0
}

function irANotificacion(n) {
  showNotifDropdown.value = false
  if (n.media_id) router.push('/')
  if (!n.leida) marcarLeida(n.id)
}

function clickFueraNotif(e) {
  if (!e.target.closest('.notif-wrapper')) {
    showNotifDropdown.value = false
  }
}

async function logout() {
  await auth.logout()
  torneo.$reset()
  router.push('/')
}

function handleJSON() {
  if (torneo.torneoActual) exportarJSON(torneo.torneoActual)
}
function handleCSV() {
  if (torneo.torneoActual) exportarCSV(torneo.torneoActual)
}
function handlePDF() {
  if (torneo.torneoActual) exportarPDF(torneo.torneoActual)
}
async function handleRespaldo() {
  await respaldarDatos()
}
async function handleRecomputar() {
  await recomputarEstadisticas(torneo.torneoActual)
}
function handleRestaurar() {
  restaurarRespaldo()
}

function handleNotifications() {
  router.push('/fixture')
}

async function verificarNotificaciones() {
  if (!torneo.torneoActual || !auth.isLoggedIn) return
  try {
    const resultados = await db.getResultados(torneo.torneoActual)
    const fixture = await db.getFixture(torneo.torneoActual)
    const pendientes = fixture.filter(f => !resultados.some(r => r.fixture_id === f.id))
    notifCount.value = pendientes.length
  } catch { notifCount.value = 0 }
}

function togglePushPermiso() {
  pedirPermisoNotificaciones()
}

onMounted(async () => {
  await config.loadConfig()
  await auth.init()
  if (auth.isLoggedIn) {
    await torneo.init()
    loadNotifCount()
    notifInterval = setInterval(loadNotifCount, 30000)
    document.addEventListener('click', clickFueraNotif)
  }
})

onUnmounted(() => {
  if (notifInterval) clearInterval(notifInterval)
  document.removeEventListener('click', clickFueraNotif)
})
</script>

<template>
  <template v-if="auth.loading">
    <div class="spinner" style="min-height:100vh;">
      <div class="spinner-ring" style="width:48px;height:48px;border-width:5px;"></div>
      <span style="color:var(--gold); font-size:1.2rem;">Cargando {{ config.titulo }}...</span>
    </div>
  </template>

  <template v-else-if="!auth.isLoggedIn">
    <IntroOverlay />
    <div class="login-wrapper">
      <div style="background:var(--bg-card); border:2px solid #eab308; border-radius:12px; padding:40px; width:100%; max-width:400px; box-shadow:0 15px 50px rgba(0,0,0,0.8);">
        <LoginForm />
      </div>
    </div>
  </template>

  <template v-else-if="auth.isLoggedIn && !auth.isApproved">
    <div class="login-wrapper">
      <div style="background:var(--bg-card); border:2px solid #f97316; border-radius:16px; padding:50px 40px; width:100%; max-width:500px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.9);">
        <h1 style="color:#f97316; margin-bottom:20px; font-size:3rem;">⏳</h1>
        <h2 style="color:#ffffff; margin-bottom:15px;">Acceso Pendiente</h2>
        <p style="color:var(--text-accent); font-size:1rem; margin-bottom:20px;">
          Tu cuenta está en espera de aprobación del administrador.
        </p>
        <p style="color:var(--text-accent); font-size:0.95rem; margin-bottom:30px;">
          Email: <strong style="color:#eab308;">{{ auth.user?.email }}</strong>
        </p>
        <p style="color:#a0aab4; font-size:0.9rem; margin-bottom:30px;">
          Recibirás un email cuando tu cuenta sea aprobada.
        </p>
        <button @click="logout" style="padding:14px 30px; background:#ef4444; color:white; font-weight:900; border:none; border-radius:8px; cursor:pointer; font-size:1rem; text-transform:uppercase;">← Cerrar Sesión</button>
      </div>
    </div>
  </template>

  <template v-else>
    <header>
      <div class="header-row">
        <div style="display:flex; align-items:center; gap:10px;">
          <img v-if="config.logo_url" :src="config.logo_url" style="height:36px; width:36px; border-radius:50%; object-fit:cover;" />
          <h1>{{ config.titulo }}</h1>
        </div>
        <div class="header-actions">
          <button class="hamburger" @click="navOpen = !navOpen" aria-label="Abrir menú de navegación">☰</button>
          <button class="btn-icon" @click="themeStore.toggleTheme(); config.applyBackground()" aria-label="Cambiar tema">{{ themeStore.theme === 'dark' ? '☀️' : '🌙' }}</button>
          <button class="btn-icon" @click="router.push('/perfil')" aria-label="Perfil">👤</button>
          <button class="btn-icon" @click="togglePushPermiso" aria-label="Notificaciones push" title="Activar notificaciones push">🔕</button>
          <div class="notif-wrapper" style="position:relative;">
            <button class="btn-icon btn-notif" @click.stop="toggleNotifDropdown" aria-label="Notificaciones">🔔<span v-if="notifCount > 0" class="notif-badge">{{ notifCount }}</span></button>
            <div v-if="showNotifDropdown"
              style="position:absolute; top:100%; right:0; width:320px; max-height:400px; overflow-y:auto; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,0.5); z-index:100; margin-top:6px;"
>
              <div style="padding:10px 12px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:white; font-size:0.85rem;">Notificaciones</strong>
                <button v-if="notifCount > 0" @click="marcarTodasLeidas" style="background:none; border:none; color:#eab308; cursor:pointer; font-size:0.75rem;">Marcar todo leído</button>
              </div>
              <div v-if="notifList.length === 0" style="color:var(--text-muted); text-align:center; padding:20px; font-size:0.8rem;">Sin notificaciones</div>
              <div v-for="n in notifList" :key="n.id" @click="irANotificacion(n)"
                style="padding:10px 12px; cursor:pointer; display:flex; align-items:flex-start; gap:8px; border-bottom:1px solid var(--border);"
                :style="{ background: n.leida ? 'transparent' : 'rgba(234,179,8,0.08)' }"
>
                <span style="font-size:1.1rem; flex-shrink:0; margin-top:2px;">{{ n.tipo === 'like' ? '❤️' : n.tipo === 'comment' ? '💬' : '📢' }}</span>
                <div style="flex:1; min-width:0;">
                  <p style="color:white; font-size:0.8rem; margin:0; word-wrap:break-word;">{{ n.mensaje }}</p>
                  <span style="color:var(--text-muted); font-size:0.65rem;">{{ new Date(n.created_at).toLocaleDateString('es-UY', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) }}</span>
                </div>
                <span v-if="!n.leida" style="width:8px; height:8px; border-radius:50%; background:#eab308; flex-shrink:0; margin-top:6px;"></span>
              </div>
            </div>
          </div>
          <button class="btn-danger" @click="logout" aria-label="Cerrar sesión">🚪 Cerrar Sesión</button>
        </div>
      </div>

      <div class="toolbar" v-if="torneo.torneos.length">
        <select :value="torneo.torneoActual" @change="torneo.selectTorneo($event.target.value)">
          <option v-for="t in torneo.torneos" :key="t.id" :value="t.id">{{ t.nombre }}</option>
        </select>
        <div class="toolbar-actions">
          <button v-if="auth.isAdmin" @click="() => torneo.crearTorneo()" class="btn-sm btn-primary">+ Nuevo Torneo</button>
          <button v-if="auth.isAdmin" @click="handleRespaldo" class="btn-sm btn-success">💾 Respaldo</button>
          <button v-if="auth.isAdmin" @click="handleRestaurar" class="btn-sm btn-purple">📂 Restaurar</button>
          <button v-if="auth.isAdmin" @click="handleRecomputar" class="btn-sm btn-danger">🔄 Recomputar</button>
          <button @click="handleJSON" class="btn-sm btn-primary">📄 JSON</button>
          <button @click="handleCSV" class="btn-sm btn-purple">📊 CSV</button>
          <button @click="handlePDF" class="btn-sm btn-orange">📑 PDF</button>
        </div>
      </div>

      <nav class="nav-main" :class="{ open: navOpen }">
        <button class="nav-close" @click="navOpen = false">✕</button>
        <button
          v-for="item in visibleNavItems"
          :key="item.path"
          class="nav-btn"
          :class="{ active: isActive(item.path) }"
          @click="navigate(item.path)"
        >
          {{ item.icon }} {{ item.label }}
        </button>
      </nav>
    </header>

    <main>
      <SponsorBanner v-if="auth.isApproved" />
      <router-view />
    </main>
    <footer style="text-align:center; padding:20px; font-size:0.75rem; color:var(--text-muted); border-top:1px solid var(--border); margin-top:20px;">
      <router-link to="/privacidad" style="color:#eab308; text-decoration:none;">Política de Privacidad</router-link>
    </footer>
  </template>
</template>
