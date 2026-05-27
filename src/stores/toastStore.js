import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'

export const useToastStore = defineStore('toast', {
  actions: {
    show(mensaje, tipo = 'error') {
      const existing = document.getElementById('toast-notif')
      if (existing) existing.remove()
      const toast = document.createElement('div')
      toast.id = 'toast-notif'
      const bgColor = tipo === 'success' ? '#22c55e' : tipo === 'warning' ? '#f97316' : '#ef4444'
      toast.style.cssText = `position:fixed;top:20px;right:20px;z-index:9999;background:${bgColor};color:white;padding:16px 24px;border-radius:8px;font-family:sans-serif;font-size:0.9rem;box-shadow:0 8px 30px rgba(0,0,0,0.5);max-width:400px;animation:slideIn 0.3s ease;`
      toast.textContent = mensaje
      document.body.appendChild(toast)
      setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500) }, 5000)
    },
    success(msg) { this.show(msg, 'success') },
    error(msg) { this.show(msg, 'error') },
    warning(msg) { this.show(msg, 'warning') }
  }
})
