import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: localStorage.getItem('theme') || 'dark',
  }),
  actions: {
    init() {
      document.documentElement.setAttribute('data-theme', this.theme)
    },
    setTheme(t) {
      this.theme = t
      localStorage.setItem('theme', t)
      document.documentElement.setAttribute('data-theme', t)
    },
    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },
  },
})
