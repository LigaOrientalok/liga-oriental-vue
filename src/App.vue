<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './stores/authStore'
import { useTorneoStore } from './stores/torneoStore'
import LoginForm from './components/LoginForm.vue'
import IntroOverlay from './components/IntroOverlay.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const torneo = useTorneoStore()

const navOpen = ref(false)

const navItems = [
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

async function logout() {
  await auth.logout()
  location.reload()
}

onMounted(async () => {
  await auth.init()
  if (auth.isLoggedIn) {
    await torneo.init()
  }
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

  <template v-else>
    <header>
      <div class="header-row">
        <h1>LIGA <span style="color:#eab308;">ORIENTAL</span></h1>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="hamburger" @click="navOpen = !navOpen">☰</button>
          <button @click="router.push('/admin')" style="background:#30363d; color:white; padding:10px 16px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem;">👤</button>
          <button style="background:#30363d; color:white; padding:10px 14px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; position:relative;">🔔<span id="notif-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;font-size:0.6rem;padding:2px 5px;border-radius:50%;font-weight:bold;"></span></button>
          <button @click="logout" style="background:#ef4444; color:white; padding:10px 20px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">🚪 Cerrar Sesión</button>
        </div>
      </div>

      <div class="toolbar" v-if="torneo.torneos.length">
        <select :value="torneo.torneoActual" @change="torneo.selectTorneo($event.target.value)" style="padding:8px; border-radius:6px; background:#0d1117; color:white; border:1px solid #30363d; flex:1; min-width:200px; margin:0;">
          <option v-for="t in torneo.torneos" :key="t.id" :value="t.id">{{ t.nombre }}</option>
        </select>
        <button v-if="auth.isAdmin" @click="" class="btn-mini" style="background:#3b82f6; color:white;">+ Nuevo Torneo</button>
        <button v-if="auth.isAdmin" @click="" class="btn-mini" style="background:#22c55e; color:white;">💾 Respaldo</button>
        <button v-if="auth.isAdmin" @click="" class="btn-mini" style="background:#ef4444; color:white;">🔄 Recomputar</button>
        <button @click="" class="btn-mini" style="background:#3b82f6; color:white;">📄 JSON</button>
        <button @click="" class="btn-mini" style="background:#a855f7; color:white;">📊 CSV</button>
        <button @click="" class="btn-mini" style="background:#f97316; color:white;">📑 PDF</button>
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
