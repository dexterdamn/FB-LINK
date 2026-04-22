import { ref } from 'vue'

const toasts = ref([])

function nextId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function removeToast(id) {
  const idx = toasts.value.findIndex((t) => t.id === id)
  if (idx !== -1) toasts.value.splice(idx, 1)
}

function pushToast({
  type = 'info',
  title = '',
  message = '',
  durationMs = 3500
} = {}) {
  const id = nextId()
  const toast = {
    id,
    type,
    title,
    message,
    createdAt: Date.now(),
    durationMs
  }

  toasts.value.push(toast)

  if (Number.isFinite(durationMs) && durationMs > 0) {
    window.setTimeout(() => removeToast(id), durationMs)
  }

  return id
}

export function useToast() {
  return {
    toasts,
    removeToast,
    push: pushToast,
    success(message, opts = {}) {
      return pushToast({ type: 'success', message, ...opts })
    },
    error(message, opts = {}) {
      return pushToast({ type: 'error', message, ...opts })
    },
    info(message, opts = {}) {
      return pushToast({ type: 'info', message, ...opts })
    }
  }
}

