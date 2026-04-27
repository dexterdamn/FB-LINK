import { computed, onMounted, ref, watch } from 'vue'
import { storageService } from '../services/storageService'

const THEME_KEY = 'theme'

function getInitialTheme() {
  const settings = storageService.getSettings?.() || {}
  const saved = typeof settings[THEME_KEY] === 'string' ? settings[THEME_KEY] : ''
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  return 'system'
}

function applyTheme(theme) {
  const t = theme === 'dark' || theme === 'light' ? theme : 'system'
  const el = document.documentElement
  if (t === 'system') {
    el.removeAttribute('data-theme')
  } else {
    el.setAttribute('data-theme', t)
  }
}

export function useTheme() {
  const theme = ref(getInitialTheme())

  const effectiveTheme = computed(() => {
    if (theme.value === 'dark' || theme.value === 'light') return theme.value
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
  })

  const setTheme = (next) => {
    const v = next === 'light' || next === 'dark' || next === 'system' ? next : 'system'
    theme.value = v
  }

  const toggleTheme = () => {
    // Toggle between light/dark; keep "system" as a separate explicit choice in UI later.
    setTheme(effectiveTheme.value === 'dark' ? 'light' : 'dark')
  }

  onMounted(() => {
    applyTheme(theme.value)
  })

  watch(theme, (t) => {
    applyTheme(t)
    const settings = storageService.getSettings?.() || {}
    storageService.saveSettings?.({ ...settings, [THEME_KEY]: t })
  })

  return { theme, effectiveTheme, setTheme, toggleTheme }
}

