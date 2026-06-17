<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { db } from '../lib/db'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'

const auth = useAuthStore()
const toast = useToastStore()

const mediaItems = ref([])
const showUpload = ref(false)
const selectedMedia = ref(null)
const uploadTitulo = ref('')
const uploadDesc = ref('')
const uploadTipo = ref('imagen')
const uploadArchivo = ref(null)
const uploadPreview = ref(null)
const uploadSaving = ref(false)

// like / comment state
const likeCount = ref(0)
const userLiked = ref(false)
const likeLoading = ref(false)
const comments = ref([])
const newComment = ref('')
const commentSaving = ref(false)

async function cargarMedia() {
  try {
    mediaItems.value = await db.getMedia()
  } catch (e) { console.error(e) }
}

function onUploadFile(e) {
  const file = e.target.files[0]
  if (!file) return
  uploadArchivo.value = file
  const reader = new FileReader()
  reader.onload = ev => { uploadPreview.value = ev.target.result }
  reader.readAsDataURL(file)
}

async function subirMedia() {
  if (!uploadTitulo.value.trim()) { toast.warning('Ingresá un título'); return }
  if (uploadTipo.value === 'imagen' && !uploadArchivo.value) { toast.warning('Seleccioná una imagen'); return }
  if (uploadTipo.value === 'video' && !uploadPreview.value?.trim()) { toast.warning('Ingresá la URL del video'); return }
  uploadSaving.value = true
  try {
    const contenido = uploadTipo.value === 'imagen' ? uploadPreview.value : uploadPreview.value.trim()
    await db.createMedia(uploadTitulo.value.trim(), uploadDesc.value.trim() || null, uploadTipo.value, contenido)
    toast.success('✅ Subido')
    uploadTitulo.value = ''
    uploadDesc.value = ''
    uploadTipo.value = 'imagen'
    uploadArchivo.value = null
    uploadPreview.value = null
    showUpload.value = false
    await cargarMedia()
  } catch (e) {
    toast.error('Error al subir')
  } finally {
    uploadSaving.value = false
  }
}

async function eliminarMedia(id) {
  try {
    await db.deleteMedia(id)
    toast.success('🗑️ Eliminado')
    await cargarMedia()
  } catch (e) {
    toast.error('Error al eliminar')
  }
}

// --- Lightbox ---
async function abrirMedia(m) {
  selectedMedia.value = m
  likeLoading.value = true
  try {
    const [likesResult, commentsResult] = await Promise.all([
      db.getMediaLikes(m.id),
      db.getMediaComments(m.id)
    ])
    likeCount.value = likesResult.count
    userLiked.value = likesResult.userLiked
    comments.value = commentsResult
  } catch (e) {
    console.error(e)
  } finally {
    likeLoading.value = false
  }
}

function cerrarMedia() {
  selectedMedia.value = null
  comments.value = []
  newComment.value = ''
}

function onKeydown(e) {
  if (e.key === 'Escape') cerrarMedia()
}

async function toggleLike() {
  if (likeLoading.value) return
  likeLoading.value = true
  try {
    const result = await db.toggleLike(selectedMedia.value.id)
    if (result) {
      likeCount.value = result.count
      userLiked.value = result.userLiked
    }
  } catch (e) {
    console.error(e)
  } finally {
    likeLoading.value = false
  }
}

async function enviarComentario() {
  if (!newComment.value.trim()) return
  commentSaving.value = true
  try {
    await db.addComment(selectedMedia.value.id, newComment.value.trim())
    newComment.value = ''
    comments.value = await db.getMediaComments(selectedMedia.value.id)
    toast.success('💬 Comentario enviado')
  } catch (e) {
    toast.error('Error al comentar')
  } finally {
    commentSaving.value = false
  }
}

async function borrarComentario(id) {
  try {
    await db.deleteComment(id)
    comments.value = await db.getMediaComments(selectedMedia.value.id)
    toast.success('🗑️ Comentario eliminado')
  } catch (e) {
    toast.error('Error al eliminar comentario')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  cargarMedia()
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="box">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:15px;">
      <h4 style="color:#eab308; margin:0;">📸 Galería de la Liga</h4>
      <button v-if="auth.isApproved" class="btn-mini" style="background:#eab308; color:black;" @click="showUpload = !showUpload">
        {{ showUpload ? '✕ Cerrar' : '📤 Subir' }}
      </button>
    </div>

    <div v-if="showUpload" style="background:var(--bg-input); border-radius:8px; padding:15px; margin-bottom:15px; border-left:4px solid #eab308;">
      <label class="label-accent">Título:</label>
      <input type="text" v-model="uploadTitulo" placeholder="Título" />
      <label class="label-accent">Descripción (opcional):</label>
      <input type="text" v-model="uploadDesc" placeholder="Descripción" />
      <label class="label-accent">Tipo:</label>
      <select v-model="uploadTipo" style="padding:8px; border-radius:6px; background:var(--bg-input); color:white; border:1px solid var(--border);">
        <option value="imagen">Imagen</option>
        <option value="video">Video (URL)</option>
      </select>
      <div v-if="uploadTipo === 'imagen'">
        <label class="label-accent">Archivo:</label>
        <input type="file" accept="image/*" @change="onUploadFile" />
        <div v-if="uploadPreview" style="margin-top:8px;">
          <img :src="uploadPreview" style="max-width:200px; max-height:120px; border-radius:6px; border:2px solid var(--border); object-fit:cover;" />
        </div>
      </div>
      <div v-else>
        <label class="label-accent">URL del video (YouTube embed):</label>
        <input type="url" v-model="uploadPreview" placeholder="https://www.youtube.com/embed/..." />
      </div>
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button class="btn-main" @click="subirMedia" :disabled="uploadSaving" style="padding:8px 20px; font-size:0.85rem;">
          {{ uploadSaving ? '⏳' : '✅ Subir' }}
        </button>
        <button class="btn-mini" style="background:#6b7280; color:white;" @click="showUpload = false">Cancelar</button>
      </div>
    </div>

    <div v-if="mediaItems.length === 0" style="color:var(--text-muted); text-align:center; padding:20px;">
      No hay contenido multimedia todavía
    </div>
    <div v-else style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
      <div v-for="m in mediaItems" :key="m.id" style="background:var(--bg-input); border-radius:8px; overflow:hidden; border:1px solid var(--border); position:relative; cursor:pointer;">
        <template v-if="m.tipo === 'video'">
          <iframe :src="m.contenido" frameborder="0" allowfullscreen style="width:100%; aspect-ratio:16/9; pointer-events:none;" @click="abrirMedia(m)"></iframe>
        </template>
        <img v-else :src="m.contenido" :alt="m.titulo" style="width:100%; aspect-ratio:16/9; object-fit:cover;" @click="abrirMedia(m)" />
        <div style="padding:8px;">
          <strong style="color:white; font-size:0.85rem; display:block;">{{ m.titulo }}</strong>
          <span v-if="m.descripcion" style="color:var(--text-muted); font-size:0.75rem;">{{ m.descripcion }}</span>
        </div>
        <button v-if="auth.isAdmin" @click="eliminarMedia(m.id)" class="btn-mini" style="position:absolute; top:6px; right:6px; background:rgba(239,68,68,0.8); color:white; padding:2px 8px; font-size:0.7rem;">🗑️</button>
      </div>
    </div>

    <!-- Lightbox con likes y comentarios -->
    <div v-if="selectedMedia" @click.self="cerrarMedia" style="position:fixed; inset:0; background:rgba(0,0,0,0.88); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
      <div style="position:relative; max-width:95vw; max-height:95vh; width:100%;">
        <button @click="cerrarMedia" style="position:absolute; top:-36px; right:0; background:none; border:none; color:white; font-size:1.5rem; cursor:pointer; z-index:1;">✕</button>
        <div style="background:var(--bg-card); border-radius:10px; max-width:95vw; max-height:95vh; overflow:hidden; display:flex; flex-direction:column;">
          <!-- media -->
          <div style="flex:1; min-height:0; display:flex; align-items:center; justify-content:center; background:#000; padding:8px;">
            <template v-if="selectedMedia.tipo === 'video'">
              <iframe :src="selectedMedia.contenido" frameborder="0" allowfullscreen style="width:100%; max-width:900px; aspect-ratio:16/9; border-radius:6px;"></iframe>
            </template>
            <img v-else :src="selectedMedia.contenido" :alt="selectedMedia.titulo" style="max-width:100%; max-height:60vh; border-radius:6px; object-fit:contain;" />
          </div>
          <!-- info + likes + comments -->
          <div style="padding:12px 16px; border-top:1px solid var(--border);">
            <strong style="color:white; font-size:0.95rem;">{{ selectedMedia.titulo }}</strong>
            <span v-if="selectedMedia.descripcion" style="display:block; color:var(--text-muted); font-size:0.8rem; margin-top:2px;">{{ selectedMedia.descripcion }}</span>
            <!-- like button -->
            <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
              <button @click="toggleLike" :disabled="likeLoading" style="background:none; border:none; cursor:pointer; font-size:1.3rem; display:flex; align-items:center; gap:4px; padding:0; color:inherit;">
                <span :style="{ color: userLiked ? '#ef4444' : '#9ca3af' }">{{ userLiked ? '❤️' : '🤍' }}</span>
                <span style="color:var(--text-muted); font-size:0.85rem;">{{ likeCount }}</span>
              </button>
            </div>
            <!-- comments -->
            <div style="margin-top:8px; border-top:1px solid var(--border); padding-top:8px; max-height:200px; overflow-y:auto;">
              <div v-for="c in comments" :key="c.id" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                <div>
                  <strong style="color:#eab308; font-size:0.75rem;">{{ c.username }}</strong>
                  <p style="color:white; font-size:0.8rem; margin:0;">{{ c.contenido }}</p>
                </div>
                <button v-if="auth.user?.id === c.user_id || auth.isAdmin" @click="borrarComentario(c.id)" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.7rem; padding:2px;">🗑️</button>
              </div>
              <div v-if="comments.length === 0" style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:6px;">Sin comentarios</div>
            </div>
            <!-- add comment -->
            <div v-if="auth.isApproved" style="display:flex; gap:6px; margin-top:8px;">
              <input type="text" v-model="newComment" placeholder="Escribí un comentario..." @keyup.enter="enviarComentario" style="flex:1; font-size:0.8rem;" />
              <button @click="enviarComentario" :disabled="commentSaving || !newComment.trim()" class="btn-mini" style="background:#eab308; color:black; font-size:0.75rem; padding:4px 10px;">{{ commentSaving ? '⏳' : 'Enviar' }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
