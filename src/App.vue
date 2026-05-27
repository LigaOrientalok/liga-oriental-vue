<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './stores/authStore'
import { useTorneoStore } from './stores/torneoStore'
import { useTheme } from './stores/themeStore'
import LoginForm from './components/LoginForm.vue'
import IntroOverlay from './components/IntroOverlay.vue'
import { exportarJSON, exportarCSV, exportarPDF, respaldarDatos, recomputarEstadisticas, restaurarRespaldo } from './lib/export'
import { db } from './lib/db'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const torneo = useTorneoStore()
const { theme, toggleTheme } = useTheme()

const navOpen = ref(false)

const navItems = [
  { path: '/', label: 'INICIO', icon: '🏠' },
  { path: '/registro', label: 'REGISTRO', icon: '' },
  { path: '/tablas', label: 'TABLAS', icon: '' },
  { path: '/fixture', label: 'FIXTURE', icon: '📅' },
  { path: '/stats', label: 'STATS', icon: '📊' },
  { path: '/fama', label: 'FAMA', icon: '🏆' },
  { path: '/jugadores', label: 'JUGADORES', icon: '🔍' },
  { path: '/equipos', label: 'EQUIPOS', icon: '📋' },
  { path: '/historial', label: 'HISTORIAL', icon: '📜' },
  { path: '/misiones', label: 'MISIONES', icon: '🎯' },
  { path: '/admin', label: 'ADMIN', icon: '⚙️' }
]

const visibleNavItems = computed(() => {
  if (auth.isAdmin) return navItems
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
let notifInterval = null

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

onMounted(async () => {
  await auth.init()
  if (auth.isLoggedIn) {
    await torneo.init()
    verificarNotificaciones()
    notifInterval = setInterval(verificarNotificaciones, 30000)
  }
})

onUnmounted(() => {
  if (notifInterval) clearInterval(notifInterval)
})
</script>

<template>
  <template v-if="auth.loading">
    <div style="min-height:100vh; display:flex; justify-content:center; align-items:center; background:#0b0e14; color:#eab308; font-family:sans-serif; font-size:1.2rem;">
      <div style="text-align:center;">
        <div style="font-size:3rem; margin-bottom:20px;">⚡</div>
        <div>Cargando Liga Oriental...</div>
      </div>
    </div>
  </template>

  <template v-else-if="!auth.isLoggedIn">
    <IntroOverlay />
    <div class="login-wrapper">
      <div style="background:#161b22; border:2px solid #eab308; border-radius:12px; padding:40px; width:100%; max-width:400px; box-shadow:0 15px 50px rgba(0,0,0,0.8);">
        <LoginForm />
      </div>
    </div>
  </template>

  <template v-else-if="auth.isLoggedIn && !auth.isApproved">
    <div class="login-wrapper">
      <div style="background:#161b22; border:2px solid #f97316; border-radius:16px; padding:50px 40px; width:100%; max-width:500px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.9);">
        <h1 style="color:#f97316; margin-bottom:20px; font-size:3rem;">⏳</h1>
        <h2 style="color:#ffffff; margin-bottom:15px;">Acceso Pendiente</h2>
        <p style="color:#b0bcc4; font-size:1rem; margin-bottom:20px;">
          Tu cuenta está en espera de aprobación del administrador.
        </p>
        <p style="color:#b0bcc4; font-size:0.95rem; margin-bottom:30px;">
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
        <h1>LIGA <span style="color:#eab308;">ORIENTAL</span></h1>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="hamburger" @click="navOpen = !navOpen">☰</button>
          <button @click="toggleTheme" style="background:var(--btn-bg); color:var(--text); padding:10px 14px; border:none; border-radius:6px; cursor:pointer; font-size:1rem;">{{ theme === 'dark' ? '☀️' : '🌙' }}</button>
          <button @click="router.push('/admin')" style="background:var(--btn-bg); color:var(--text); padding:10px 16px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem;">👤</button>
          <button @click="handleNotifications" style="background:var(--btn-bg); color:var(--text); padding:10px 14px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; position:relative;">🔔<span v-if="notifCount > 0" style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;font-size:0.6rem;padding:2px 5px;border-radius:50%;font-weight:bold;">{{ notifCount }}</span></button>
          <button @click="logout" style="background:#ef4444; color:white; padding:10px 20px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">🚪 Cerrar Sesión</button>
        </div>
      </div>

      <div class="toolbar" v-if="torneo.torneos.length">
        <select :value="torneo.torneoActual" @change="torneo.selectTorneo($event.target.value)" style="padding:8px; border-radius:6px; background:#0d1117; color:white; border:1px solid #30363d; flex:1; min-width:200px; margin:0;">
          <option v-for="t in torneo.torneos" :key="t.id" :value="t.id">{{ t.nombre }}</option>
        </select>
        <button v-if="auth.isAdmin" @click="() => torneo.crearTorneo()" class="btn-mini" style="background:#3b82f6; color:white;">+ Nuevo Torneo</button>
        <button v-if="auth.isAdmin" @click="handleRespaldo" class="btn-mini" style="background:#22c55e; color:white;">💾 Respaldo</button>
        <button v-if="auth.isAdmin" @click="handleRestaurar" class="btn-mini" style="background:#a855f7; color:white;">📂 Restaurar</button>
        <button v-if="auth.isAdmin" @click="handleRecomputar" class="btn-mini" style="background:#ef4444; color:white;">🔄 Recomputar</button>
        <button @click="handleJSON" class="btn-mini" style="background:#3b82f6; color:white;">📄 JSON</button>
        <button @click="handleCSV" class="btn-mini" style="background:#a855f7; color:white;">📊 CSV</button>
        <button @click="handlePDF" class="btn-mini" style="background:#f97316; color:white;">📑 PDF</button>
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
      <router-view />
    </main>
  </template>
</template>
