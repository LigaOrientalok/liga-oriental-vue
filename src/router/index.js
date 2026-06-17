import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const routes = [
  { path: '/', name: 'Inicio', component: () => import('../views/HomeView.vue') },
  { path: '/registro', name: 'Registro', component: () => import('../views/RegisterView.vue') },
  { path: '/tablas', name: 'Tablas', component: () => import('../views/StandingsView.vue') },
  { path: '/fixture', name: 'Fixture', component: () => import('../views/FixtureView.vue') },
  { path: '/stats', name: 'Stats', component: () => import('../views/StatsView.vue') },
  { path: '/fama', name: 'Fama', component: () => import('../views/FameView.vue') },
  { path: '/jugadores', name: 'Jugadores', component: () => import('../views/PlayersView.vue') },
  { path: '/equipos', name: 'Equipos', component: () => import('../views/TeamsView.vue') },
  { path: '/historial', name: 'Historial', component: () => import('../views/HistoryView.vue') },
  { path: '/misiones', name: 'Misiones', component: () => import('../views/MisionesView.vue') },
  { path: '/admin', name: 'Admin', component: () => import('../views/AdminView.vue'), meta: { requiresAuth: true } },
  { path: '/perfil', name: 'Perfil', component: () => import('../views/ProfileView.vue'), meta: { requiresAuth: true } },
  { path: '/delegado', name: 'Delegado', component: () => import('../views/DelegadoView.vue'), meta: { requiresDelegado: true } },
  { path: '/jugador/:id', name: 'JugadorDetail', component: () => import('../views/PlayerDetailView.vue') },
  { path: '/equipo/:id', name: 'TeamDetail', component: () => import('../views/TeamDetailView.vue') },
  { path: '/comparar', name: 'Comparar', component: () => import('../views/CompareView.vue') },
  { path: '/live', name: 'Live', component: () => import('../views/LiveView.vue') },
  { path: '/ranking', name: 'Ranking', component: () => import('../views/RankingsView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth) {
    if (!auth.isLoggedIn || !auth.isAdmin) return next('/')
  }
  if (to.meta.requiresDelegado) {
    if (!auth.isLoggedIn || !(auth.isAdmin || auth.isDelegado)) return next('/')
  }
  next()
})

export default router
