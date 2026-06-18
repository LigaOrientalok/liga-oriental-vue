import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import { useToastStore } from './toastStore'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    userData: null,
    session: null,
    loading: true
  }),

  getters: {
    isAdmin: (state) => state.userData?.rol === 'admin',
    isArbitro: (state) => state.userData?.rol === 'arbitro',
    isDelegado: (state) => state.userData?.rol === 'delegado',
    isLoggedIn: (state) => !!state.session,
    isApproved: (state) => state.userData?.estado === 'aprobado' || state.userData?.rol === 'admin' || state.userData?.rol === 'delegado'
  },

  actions: {
    async init() {
      this.loading = true
      try {
        const { data: { session } } = await supabase.auth.getSession()
        this.session = session
        this.user = session?.user || null

        if (this.user) {
          await this.loadUserData()
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('Error en auth init:', e)
      } finally {
        this.loading = false
      }
    },

    async loadUserData() {
      if (!this.user) return
      try {
        const { data, error } = await supabase.from('usuarios').select('*').eq('id', this.user.id).maybeSingle()
        if (error) throw error
        this.userData = data
        if (!data) {
          const { data: newUser, error: insertError } = await supabase.from('usuarios').upsert({
            id: this.user.id, email: this.user.email, rol: 'usuario', estado: 'pendiente', fecha_registro: new Date().toISOString()
          }).select().maybeSingle()
          if (insertError) throw insertError
          this.userData = newUser || { rol: 'usuario', estado: 'pendiente' }
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('Error loading user data:', e)
      }
    },

    async login(email, password) {
      const toast = useToastStore()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error('Email o contraseña incorrectos')
        return false
      }
      this.user = data.user
      this.session = data.session
      await this.loadUserData()
      toast.success('✅ ¡Bienvenido!')
      return true
    },

    async register(email, password) {
      const toast = useToastStore()
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        toast.error(error.message)
        return false
      }
      if (data?.user) {
        await supabase.from('usuarios').upsert({
          id: data.user.id, email: data.user.email, rol: 'usuario', estado: 'pendiente', fecha_registro: new Date().toISOString()
        })
      }
      toast.success('✅ Cuenta creada. Revisá tu email para confirmar.')
      return true
    },

    async logout() {
      const toast = useToastStore()
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast.error('Error al cerrar sesión')
        return
      }
      this.user = null
      this.userData = null
      this.session = null
    },

    async resetPassword(email) {
      const toast = useToastStore()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      })
      if (error) {
        toast.error('Error: ' + error.message)
      } else {
        toast.success('📧 Revisá tu email para restablecer la contraseña')
      }
    },

    async soloAdmin() {
      const { data } = await supabase.from('usuarios').select('rol').eq('id', this.user?.id).maybeSingle()
      if (data?.rol !== 'admin') throw new Error('Acceso denegado: se requiere admin')
    }
  }
})
