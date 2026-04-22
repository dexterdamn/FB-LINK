<template>
  <div class="toast-host" aria-live="polite" aria-relevant="additions removals">
    <transition-group name="toast" tag="div" class="toast-stack">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`toast--${t.type}`"
        role="status"
      >
        <div class="toast__icon" aria-hidden="true">
          <span v-if="t.type === 'success'">✓</span>
          <span v-else-if="t.type === 'error'">!</span>
          <span v-else>i</span>
        </div>

        <div class="toast__content">
          <div v-if="t.title" class="toast__title">{{ t.title }}</div>
          <div class="toast__message">{{ t.message }}</div>
        </div>

        <button class="toast__close" type="button" @click="removeToast(t.id)" aria-label="Dismiss">
          ×
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast'

const { toasts, removeToast } = useToast()
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: calc(var(--z-modal) + 10);
  pointer-events: none;
}

.toast-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(360px, calc(100vw - 32px));
}

.toast {
  pointer-events: auto;
  display: grid;
  grid-template-columns: 28px 1fr 28px;
  gap: 10px;
  align-items: start;
  padding: 12px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.toast__icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  line-height: 1;
  margin-top: 1px;
}

.toast__title {
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 2px;
}

.toast__message {
  font-size: 0.9rem;
  line-height: 1.35;
  color: var(--text-secondary);
  word-break: break-word;
}

.toast__close {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.6;
  font-size: 18px;
  line-height: 1;
  padding: 0;
}

.toast__close:hover {
  opacity: 1;
  background: var(--bg-secondary);
}

.toast--success {
  border-color: rgba(16, 185, 129, 0.35);
}
.toast--success .toast__icon {
  color: white;
  background: var(--success);
}

.toast--error {
  border-color: rgba(239, 68, 68, 0.35);
}
.toast--error .toast__icon {
  color: white;
  background: var(--error);
}

.toast--info {
  border-color: rgba(59, 130, 246, 0.35);
}
.toast--info .toast__icon {
  color: white;
  background: var(--accent);
}

.toast-enter-active,
.toast-leave-active {
  transition: transform 180ms ease, opacity 180ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>

