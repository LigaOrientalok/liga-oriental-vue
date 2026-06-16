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
  { path: '/comparar', label: 'VS', icon: '⚔️' },
  { path: '/ranking', label: 'RANKING', icon: '📈' },
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
  await config.loadConfig()
  await auth.init()
  if (auth.isLoggedIn) {
    await torneo.init()
    verificarNotificaciones()
    notifInterval = setInterval(verificarNotificaciones, 30000)
    setTimeout(() => pedirPermisoNotificaciones(), 2000)
  }
})

onUnmounted(() => {
  if (notifInterval) clearInterval(notifInterval)
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
          <button class="btn-icon" @click="router.push('/admin')" aria-label="Perfil">👤</button>
          <button class="btn-icon btn-notif" @click="handleNotifications" aria-label="Notificaciones">🔔<span v-if="notifCount > 0" class="notif-badge">{{ notifCount }}</span></button>
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
  </template>
</template>
