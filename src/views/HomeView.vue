<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../lib/db'

const mediaItems = ref([])

async function cargarMedia() {
  try {
    mediaItems.value = await db.getMedia()
  } catch (e) { console.error(e) }
}

onMounted(() => { cargarMedia() })
</script>

<template>
  <div class="box">
    <h4 style="color:#eab308; margin-bottom:15px;">📸 Galería de la Liga</h4>

    <div v-if="mediaItems.length === 0" style="color:var(--text-muted); text-align:center; padding:20px;">
      No hay contenido multimedia todavía
    </div>
    <div v-else style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
      <div v-for="m in mediaItems" :key="m.id" style="background:var(--bg-input); border-radius:8px; overflow:hidden; border:1px solid var(--border);">
        <template v-if="m.tipo === 'video'">
          <iframe :src="m.contenido" frameborder="0" allowfullscreen style="width:100%; aspect-ratio:16/9;"></iframe>
        </template>
        <img v-else :src="m.contenido" :alt="m.titulo" style="width:100%; aspect-ratio:16/9; object-fit:cover;" />
        <div style="padding:8px;">
          <strong style="color:white; font-size:0.85rem; display:block;">{{ m.titulo }}</strong>
          <span v-if="m.descripcion" style="color:var(--text-muted); font-size:0.75rem;">{{ m.descripcion }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
