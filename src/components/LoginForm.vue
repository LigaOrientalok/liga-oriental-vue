<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/authStore'

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
