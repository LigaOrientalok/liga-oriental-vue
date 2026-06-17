<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../lib/db'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'

const auth = useAuthStore()
const toast = useToastStore()

const nombre = ref(auth.userData?.nombre || '')
const saving = ref(false)
const misMedia = ref([])
const misComentarios = ref([])
const loading = ref(true)

async function guardarPerfil() {
  saving.value = true
  try {
    await supabase.from('usuarios').update({ nombre: nombre.value.trim() || null }).eq('id', auth.user.id)
    auth.userData.nombre = nombre.value.trim() || null
    toast.success('✅ Perfil actualizado')
  } catch (e) { toast.error('Error al guardar')
  } finally { saving.value = false }
}

onMounted(async () => {
  loading.value = true
  try {
    const [media, comments] = await Promise.all([
      supabase.from('liga_media').select('*').eq('uploaded_by', auth.user.id).order('created_at', { ascending: false }),
      supabase.from('liga_media_comments').select('*, media:liga_media(titulo)').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(20)
    ])
    misMedia.value = media.data || []
    misComentarios.value = comments.data || []
  } finally { loading.value = false }
})
</script>

<template>
  <section>
    <div class="box">
      <h3 style="color:#eab308; margin-bottom:15px;">👤 Mi Perfil</h3>
      <p style="color:var(--text-muted); font-size:0.85rem;">Email: <strong style="color:white;">{{ auth.user?.email }}</strong></p>
      <p style="color:var(--text-muted); font-size:0.85rem;">Rol: <strong style="color:#eab308;">{{ auth.userData?.rol }}</strong></p>

      <label class="label-accent">Nombre visible</label>
      <div style="display:flex; gap:8px;">
        <input type="text" v-model="nombre" placeholder="Tu nombre en la app" style="flex:1;" />
        <button @click="guardarPerfil" :disabled="saving" class="btn-main" style="padding:8px 16px;">{{ saving ? '⏳' : 'Guardar' }}</button>
      </div>
    </div>

    <div v-if="loading" class="box spinner"><div class="spinner-ring"></div></div>

    <template v-else>
      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">📸 Mis publicaciones ({{ misMedia.length }})</h4>
        <div v-if="misMedia.length === 0" style="color:var(--text-muted); font-size:0.85rem;">No subiste nada todavía</div>
        <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px,1fr)); gap:8px;">
          <div v-for="m in misMedia" :key="m.id" style="border-radius:8px; overflow:hidden; border:1px solid var(--border);">
            <img v-if="m.tipo === 'imagen'" :src="m.contenido" style="width:100%; aspect-ratio:1; object-fit:cover;" />
            <div v-else style="width:100%; aspect-ratio:1; background:var(--bg-input); display:flex; align-items:center; justify-content:center; font-size:2rem;">🎬</div>
            <div style="padding:4px 6px; font-size:0.7rem; color:var(--text-muted);">{{ m.titulo }}</div>
          </div>
        </div>
      </div>

      <div class="box">
        <h4 style="color:#eab308; margin-bottom:10px;">💬 Mis comentarios ({{ misComentarios.length }})</h4>
        <div v-if="misComentarios.length === 0" style="color:var(--text-muted); font-size:0.85rem;">Sin comentarios</div>
        <div v-for="c in misComentarios" :key="c.id" style="border-bottom:1px solid var(--border); padding:8px 0;">
          <p style="color:white; font-size:0.8rem; margin:0;">{{ c.contenido }}</p>
          <span style="color:var(--text-muted); font-size:0.7rem;">en {{ c.media?.titulo || 'una publicación' }}</span>
        </div>
      </div>
    </template>
  </section>
</template>
