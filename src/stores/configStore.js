import { defineStore } from 'pinia'
import { db } from '../lib/db'

const DEFAULTS = {
  titulo: 'Liga Oriental',
  logo_url: null,
  color_primario: '#eab308',
  color_secundario: '#3b82f6',
  fondo_oscuro: '#0b0e14',
  fondo_claro: '#f0f2f5',
  email_contacto: 'bolso2340@gmail.com'
}

export const useConfigStore = defineStore('config', {
  state: () => ({
    id: null,
    titulo: DEFAULTS.titulo,
    logo_url: DEFAULTS.logo_url,
    color_primario: DEFAULTS.color_primario,
    color_secundario: DEFAULTS.color_secundario,
    fondo_oscuro: DEFAULTS.fondo_oscuro,
    fondo_claro: DEFAULTS.fondo_claro,
    email_contacto: DEFAULTS.email_contacto
  }),

  actions: {
    async loadConfig() {
      try {
        const config = await db.getConfig()
        if (config) {
          this.id = config.id
          this.titulo = config.titulo || DEFAULTS.titulo
          this.logo_url = config.logo_url
          this.color_primario = config.color_primario || DEFAULTS.color_primario
          this.color_secundario = config.color_secundario || DEFAULTS.color_secundario
          this.fondo_oscuro = config.fondo_oscuro || DEFAULTS.fondo_oscuro
          this.fondo_claro = config.fondo_claro || DEFAULTS.fondo_claro
        }
        this.applyToDOM()
      } catch (e) {
        if (import.meta.env.DEV) console.error('Error loading config:', e)
      }
    },

    applyToDOM() {
      const el = document.documentElement
      el.style.setProperty('--gold', this.color_primario)
      el.style.setProperty('--color-secundario', this.color_secundario)
      this.applyBackground()
    },

    applyBackground() {
      const el = document.documentElement
      const theme = el.getAttribute('data-theme')
      el.style.setProperty('--bg-dark', theme === 'light' ? this.fondo_claro : this.fondo_oscuro)
    },

    async saveConfig(updates) {
      try {
        if (this.id) {
          const updated = await db.updateConfig(this.id, {
            ...updates,
            updated_at: new Date().toISOString()
          })
          if (!updated) return false
        }
        Object.assign(this, updates)
        this.applyToDOM()
        return true
      } catch (e) {
        if (import.meta.env.DEV) console.error('Error saving config:', e)
        return false
      }
    }
  }
})
