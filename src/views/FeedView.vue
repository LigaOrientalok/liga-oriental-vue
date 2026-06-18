<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../lib/db'

const feed = ref([])
const loading = ref(true)

onMounted(async () => {
  try { feed.value = await db.getFeed() }
  finally { loading.value = false }
})
</script>

<template>
  <section>
    <div class="box">
      <h3 style="color:#eab308; margin-bottom:15px;">📰 Actividad Reciente</h3>
      <div v-if="loading" class="spinner"><div class="spinner-ring"></div></div>
      <div v-else-if="feed.length === 0" style="color:var(--text-muted); text-align:center; padding:20px;">Sin actividad todavía</div>
      <div v-else>
        <div v-for="a in feed" :key="a.id"
          style="display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid var(--border);"
>
          <span style="font-size:1.2rem; flex-shrink:0;">{{ a.tipo === 'gol' ? '⚽' : a.tipo === 'media' ? '📸' : a.tipo === 'comentario' ? '💬' : a.tipo === 'prediccion' ? '🔮' : '📌' }}</span>
          <div>
            <p style="color:white; font-size:0.85rem; margin:0;">{{ a.mensaje }}</p>
            <span style="color:var(--text-muted); font-size:0.7rem;">
              {{ new Date(a.created_at).toLocaleDateString('es-UY', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
