<script setup>
import { ref } from 'vue'

const visible = ref(true)

function skip() {
  visible.value = false
}

function handleVideoError() {
  skip()
}
</script>

<template>
  <div v-if="visible" id="intro-overlay">
    <div class="intro-player">
      <video autoplay muted playsinline id="intro-video" @ended="skip" @error="handleVideoError">
        <source src="/video/limol copa.mp4" type="video/mp4" />
      </video>
    </div>
    <button class="intro-skip" @click="skip">Saltar ▶</button>
  </div>
</template>

<style scoped>
#intro-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99999;
  background: #0b0e14;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 30px;
}

#intro-overlay::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url('../assets/liga.jpg') center/contain no-repeat;
  opacity: 0.06;
  pointer-events: none;
}

.intro-player {
  position: relative;
  z-index: 1;
  width: auto;
  max-width: 90%;
  max-height: 80vh;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 0 60px rgba(0,0,0,0.8), 0 0 0 2px rgba(234, 179, 8, 0.15);
  background: #000;
}

.intro-player video {
  height: 80vh;
  width: auto;
  display: block;
  max-width: 100%;
}

.intro-skip {
  position: relative;
  z-index: 1;
  padding: 14px 40px;
  background: rgba(234, 179, 8, 0.9);
  color: black;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1rem;
  transition: 0.3s;
}

.intro-skip:hover {
  background: #eab308;
}

#intro-overlay.fade-out {
  opacity: 0;
  transition: opacity 0.8s ease;
  pointer-events: none;
}
</style>
