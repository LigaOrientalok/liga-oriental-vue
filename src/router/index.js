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
  { path: '/jugador/:id', name: 'JugadorDetail', component: () => import('../views/PlayerDetailView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    const auth = useAuthStore()
    if (!auth.usuario || !auth.isAdmin) return next('/')
  }
  next()
})

export default router
