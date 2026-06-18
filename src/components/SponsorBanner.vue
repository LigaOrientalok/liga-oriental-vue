<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../lib/supabase'
import { sanitizarIframeSrc } from '../lib/helpers'

const sponsors = ref([])
const current = ref(0)
let timer = null

async function cargar() {
  const { data } = await supabase
    .from('sponsors')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true })
  sponsors.value = data || []
}

function avanzar() {
  if (sponsors.value.length > 1) {
    current.value = (current.value + 1) % sponsors.value.length
  }
}

onMounted(() => {
  cargar()
  timer = setInterval(avanzar, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div v-if="sponsors.length > 0" class="sponsor-banner">
    <div class="sponsor-slide">
      <template v-if="sponsors[current]?.tipo === 'video'">
        <iframe
          :src="sanitizarIframeSrc(sponsors[current].contenido)"
          frameborder="0"
          allowfullscreen
          class="sponsor-video"
        ></iframe>
      </template>
      <template v-else>
        <a
          v-if="sponsors[current]?.link"
          :href="sponsors[current].link"
          target="_blank"
          rel="noopener"
        >
          <img :src="sponsors[current].contenido" :alt="sponsors[current].nombre" class="sponsor-img" />
        </a>
        <img v-else :src="sponsors[current].contenido" :alt="sponsors[current].nombre" class="sponsor-img" />
      </template>
    </div>
    <div v-if="sponsors.length > 1" class="sponsor-dots">
      <span
        v-for="(_, i) in sponsors"
        :key="i"
        class="dot"
        :class="{ active: i === current }"
        @click="current = i"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.sponsor-banner {
  width: 100%;
  max-width: 728px;
  margin: 0 auto 20px;
  position: relative;
}
.sponsor-slide {
  width: 100%;
  aspect-ratio: 728 / 90;
  border-radius: 10px;
  overflow: hidden;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sponsor-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.sponsor-video {
  width: 100%;
  height: 100%;
}
.sponsor-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #555;
  cursor: pointer;
  transition: background 0.3s;
}
.dot.active {
  background: #eab308;
}
</style>
