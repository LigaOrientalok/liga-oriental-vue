<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()
const isRegister = ref(false)
const email = ref('')
const password = ref('')
const password2 = ref('')
const message = ref('')
const loading = ref(false)

function mostrarError(msg) {
  message.value = msg
}

async function handleLogin() {
  if (!email.value || !password.value) return mostrarError('Email y contraseña requeridos')
  loading.value = true
  message.value = ''
  const ok = await auth.login(email.value, password.value)
  loading.value = false
  if (!ok) mostrarError('Email o contraseña incorrectos')
}

async function handleRegister() {
  if (!email.value || !password.value || !password2.value) return mostrarError('Todos los campos son requeridos')
  if (password.value.length < 6) return mostrarError('La contraseña debe tener mínimo 6 caracteres')
  if (password.value !== password2.value) return mostrarError('Las contraseñas no coinciden')
  loading.value = true
  message.value = ''
  const ok = await auth.register(email.value, password.value)
  loading.value = false
  if (ok) {
    isRegister.value = false
    mostrarError('✅ Cuenta creada. Revisá tu email para confirmar.')
  }
}

async function handleResetPassword() {
  if (!email.value) return mostrarError('Ingresá tu email primero')
  await auth.resetPassword(email.value)
}

async function handleGoogleLogin() {
  loading.value = true
  try {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    })
  } catch (e) {
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
    <input type="email" v-model="email" placeholder="tu@email.com" />
    <label class="label-accent">Contraseña:</label>
    <input type="password" v-model="password" placeholder="Contraseña" />
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
      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Continuar con Google
    </button>
    <button class="btn-main" @click="isRegister = true; message = ''" style="background:#3b82f6; color:white;">
      Crear Nueva Cuenta
    </button>
  </div>

  <div v-else>
    <h2 style="color:#ffffff; text-align:center; font-size:1.3rem; margin-bottom:30px;">Registro</h2>
    <label class="label-accent">Email:</label>
    <input type="email" v-model="email" placeholder="tu@email.com" />
    <label class="label-accent">Contraseña:</label>
    <input type="password" v-model="password" placeholder="Mínimo 6 caracteres" />
    <label class="label-accent">Confirmar Contraseña:</label>
    <input type="password" v-model="password2" placeholder="Repite tu contraseña" />
    <button class="btn-main" @click="handleRegister" :disabled="loading" style="background:#22c55e; color:white; margin-bottom:10px;">
      {{ loading ? '⏳ Registrando...' : 'Registrarse' }}
    </button>
    <button class="btn-main" @click="isRegister = false; message = ''" style="background:#30363d; color:white;">
      Volver
    </button>
  </div>

  <div v-if="message" style="margin-top:15px; padding:12px; border-radius:6px; text-align:center; color:white;"
    :style="{ background: message.includes('✅') ? '#22c55e' : '#ef4444' }">
    {{ message }}
  </div>
</template>
