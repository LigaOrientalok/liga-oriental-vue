import { ref, watch } from 'vue'

const theme = ref(localStorage.getItem('theme') || 'dark')

function setTheme(t) {
  theme.value = t
  localStorage.setItem('theme', t)
  document.documentElement.setAttribute('data-theme', t)
}

function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

watch(theme, (t) => {
  document.documentElement.setAttribute('data-theme', t)
}, { immediate: true })

export function useTheme() {
  return { theme, toggleTheme, setTheme }
}
