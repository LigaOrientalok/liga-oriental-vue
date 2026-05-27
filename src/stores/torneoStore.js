import { defineStore } from 'pinia'
import { db } from '../lib/db'
import { useToastStore } from './toastStore'
import { useAuthStore } from './authStore'

export const useTorneoStore = defineStore('torneo', {
  state: () => ({
    torneos: [],
    torneoActual: null,
    equipos: [],
    fixture: [],
    resultados: [],
    jugadores: []
  }),

  getters: {
    equiposPorDia: (state) => {
      return (dia) => state.equipos
        .filter(e => e.dia_semana === dia)
        .sort((a, b) => (b.pts || 0) - (a.pts || 0) || ((b.gf || 0) - (b.gc || 0)) - ((a.gf || 0) - (a.gc || 0)))
    }
  },

  actions: {
    async init() {
      const torneos = await db.getTorneos()
      this.torneos = torneos
      if (torneos.length > 0) {
        this.torneoActual = torneos[0].id
        await this.loadData()
      }
    },

    selectTorneo(id) {
      this.torneoActual = parseInt(id)
      this.loadData()
    },

    async loadData() {
      if (!this.torneoActual) return
      const [equipos, fixture, resultados, jugadores] = await Promise.all([
        db.getEquipos(this.torneoActual),
        db.getFixture(this.torneoActual),
        db.getResultados(this.torneoActual),
        db.getJugadores(this.torneoActual)
      ])
      this.equipos = equipos
      this.fixture = fixture
      this.resultados = resultados
      this.jugadores = jugadores
    },

    async crearTorneo(nombre, descripcion) {
      const toast = useToastStore()
      const torneo = await db.createTorneo(nombre, descripcion)
      if (torneo) {
        this.torneoActual = torneo.id
        await this.init()
        toast.success(`Torneo "${nombre}" creado`)
        return true
      }
      return false
    },

    async recargar() {
      await this.loadData()
    }
  }
})
