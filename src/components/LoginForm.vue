<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useTorneoStore } from '../stores/torneoStore'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()
const torneo = useTorneoStore()
const isRegister = ref(false)
const email = ref('')
const password = ref('')
const password2 = ref('')
const message = ref('')
const loading = ref(false)
const touched = ref({ email: false, password: false, password2: false })
const aceptaPrivacidad = ref(false)

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const emailError = computed(() => {
  if (!touched.value.email) return ''
  if (!email.value.trim()) return 'El email es requerido'
  if (!emailRegex.test(email.value.trim())) return 'Formato de email inválido'
  return ''
})

const passwordError = computed(() => {
  if (!touched.value.password) return ''
  if (!password.value) return 'La contraseña es requerida'
  if (password.value.length < 6) return 'Mínimo 6 caracteres'
  return ''
})

const password2Error = computed(() => {
  if (!touched.value.password2 || !isRegister.value) return ''
  if (!password2.value) return 'Confirmá tu contraseña'
  if (password.value !== password2.value) return 'Las contraseñas no coinciden'
  return ''
})

const canSubmit = computed(() => {
  if (isRegister.value) {
    return email.value.trim() && emailRegex.test(email.value.trim()) &&
      password.value.length >= 6 && password.value === password2.value &&
      aceptaPrivacidad.value
  }
  return email.value.trim() && password.value.length >= 6
})

function mostrarError(msg) {
  message.value = msg
}

function onBlur(field) {
  touched.value[field] = true
}

async function handleLogin() {
  if (!canSubmit.value) {
    touched.value = { email: true, password: true, password2: true }
    return
  }
  loading.value = true
  message.value = ''
  try {
    const ok = await auth.login(email.value.trim(), password.value)
    if (ok) await torneo.init()
    else mostrarError('Email o contraseña incorrectos')
  } catch { mostrarError('Error de conexión') }
  loading.value = false
}

async function handleRegister() {
  touched.value = { email: true, password: true, password2: true }
  if (!canSubmit.value) return
  loading.value = true
  message.value = ''
  try {
    const ok = await auth.register(email.value.trim(), password.value)
    if (ok) {
      if (auth.isLoggedIn) {
        isRegister.value = false
        message.value = ''
        await torneo.init()
        return
      }
      isRegister.value = false
      mostrarError('✅ Cuenta creada. Ya podés ingresar.')
    }
  } catch { mostrarError('Error de conexión') }
  loading.value = false
}

async function handleResetPassword() {
  if (!email.value.trim()) {
    touched.value.email = true
    return mostrarError('Ingresá tu email primero')
  }
  loading.value = true
  message.value = ''
  try {
    await auth.resetPassword(email.value.trim())
  } catch { mostrarError('Error de conexión') }
  loading.value = false
}

async function handleGoogleLogin() {
  loading.value = true
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    })
    if (error) {
      mostrarError('Error al conectar con Google: ' + error.message)
      loading.value = false
    }
  } catch {
    mostrarError('Error al conectar con Google')
    loading.value = false
  }
}
</script>

<template>
  <h1 style="text-align:center; color:#eab308; margin-bottom:30px;">🔐 LIGA ORIENTAL</h1>

  <div v-if="!isRegister">
    <h2 style="color:#ffffff; text-align:center; font-size:1.3rem; margin-bottom:30px;">Iniciar Sesión</h2>
    <label class="label-accent">Email:</label>
    <input
      type="email"
      v-model="email"
      placeholder="tu@email.com"
      @blur="onBlur('email')"
      :style="{ borderColor: emailError ? '#ef4444' : '' }"
    />
    <p v-if="emailError" style="color:#ef4444; font-size:0.8rem; margin:-10px 0 10px;">{{ emailError }}</p>
    <label class="label-accent">Contraseña:</label>
    <input
      type="password"
      v-model="password"
      placeholder="Contraseña"
      @blur="onBlur('password')"
      :style="{ borderColor: passwordError ? '#ef4444' : '' }"
    />
    <p v-if="passwordError" style="color:#ef4444; font-size:0.8rem; margin:-10px 0 10px;">{{ passwordError }}</p>
    <button class="btn-main" @click="handleLogin" :disabled="loading" style="margin-bottom:10px;">
      {{ loading ? '⏳ Ingresando...' : 'Iniciar Sesión' }}
    </button>
    <p style="text-align:center; margin:10px 0;">
      <a href="#" @click.prevent="handleResetPassword" style="color:#3b82f6; font-size:0.85rem; text-decoration:none;">¿Olvidaste tu contraseña?</a>
    </p>
    <div style="display:flex; align-items:center; margin:20px 0;">
      <div style="flex:1; height:1px; background:#30363d;"></div>
      <span style="padding:0 15px; color:#8b949e; font-size:0.9rem;">O</span>
      <div style="flex:1; height:1px; background:#30363d;"></div>
    </div>
    <button @click="handleGoogleLogin" :disabled="loading" style="width:100%; padding:14px; background:white; color:black; font-weight:bold; border:none; border-radius:6px; cursor:pointer; font-size:1rem; display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:15px;">
      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
      Continuar con Google
    </button>
    <button class="btn-main" @click="isRegister = true; message = ''; touched = { email: false, password: false, password2: false }" style="background:#3b82f6; color:white;">
      Crear Nueva Cuenta
    </button>
  </div>

  <div v-else>
    <h2 style="color:#ffffff; text-align:center; font-size:1.3rem; margin-bottom:30px;">Registro</h2>
    <label class="label-accent">Email:</label>
    <input
      type="email"
      v-model="email"
      placeholder="tu@email.com"
      @blur="onBlur('email')"
      :style="{ borderColor: emailError ? '#ef4444' : '' }"
    />
    <p v-if="emailError" style="color:#ef4444; font-size:0.8rem; margin:-10px 0 10px;">{{ emailError }}</p>
    <label class="label-accent">Contraseña:</label>
    <input
      type="password"
      v-model="password"
      placeholder="Mínimo 6 caracteres"
      @blur="onBlur('password')"
      :style="{ borderColor: passwordError ? '#ef4444' : '' }"
    />
    <p v-if="passwordError" style="color:#ef4444; font-size:0.8rem; margin:-10px 0 10px;">{{ passwordError }}</p>
    <label class="label-accent">Confirmar Contraseña:</label>
    <input
      type="password"
      v-model="password2"
      placeholder="Repite tu contraseña"
      @blur="onBlur('password2')"
      :style="{ borderColor: password2Error ? '#ef4444' : '' }"
    />
    <p v-if="password2Error" style="color:#ef4444; font-size:0.8rem; margin:-10px 0 10px;">{{ password2Error }}</p>
    <label style="display:flex; align-items:center; gap:8px; margin:12px 0; font-size:0.8rem; color:var(--text-muted); cursor:pointer;">
      <input type="checkbox" v-model="aceptaPrivacidad" style="width:16px;height:16px;accent-color:#eab308;" />
      Acepto la <a href="/privacidad" target="_blank" style="color:#eab308; margin-left:4px;">Política de Privacidad</a>
    </label>
    <button class="btn-main" @click="handleRegister" :disabled="loading || !aceptaPrivacidad" style="background:#22c55e; color:white; margin-bottom:10px;">
      {{ loading ? '⏳ Registrando...' : 'Registrarse' }}
    </button>
    <button class="btn-main" @click="isRegister = false; message = ''; touched = { email: false, password: false, password2: false }" style="background:#30363d; color:white;">
      Volver
    </button>
  </div>

  <div v-if="message" style="margin-top:15px; padding:12px; border-radius:6px; text-align:center; color:white;"
    :style="{ background: message.includes('✅') ? '#22c55e' : '#ef4444' }"
>
    {{ message }}
  </div>
  <p style="text-align:center; margin-top:20px; font-size:0.75rem; color:var(--text-muted);">
    Al iniciar sesión aceptás nuestra
    <a href="/privacidad" style="color:#eab308;">Política de Privacidad</a>
  </p>
</template>
