import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/registro' },
  { path: '/registro', name: 'Registro', component: () => import('../views/RegisterView.vue') },
  { path: '/tablas', name: 'Tablas', component: () => import('../views/StandingsView.vue') },
  { path: '/fixture', name: 'Fixture', component: () => import('../views/FixtureView.vue') },
  { path: '/stats', name: 'Stats', component: () => import('../views/StatsView.vue') },
  { path: '/fama', name: 'Fama', component: () => import('../views/FameView.vue') },
  { path: '/jugadores', name: 'Jugadores', component: () => import('../views/PlayersView.vue') },
  { path: '/equipos', name: 'Equipos', component: () => import('../views/TeamsView.vue') },
  { path: '/historial', name: 'Historial', component: () => import('../views/HistoryView.vue') },
  { path: '/misiones', name: 'Misiones', component: () => import('../views/MisionesView.vue') },
  { path: '/admin', name: 'Admin', component: () => import('../views/AdminView.vue'), meta: { requiresAuth: true } }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
