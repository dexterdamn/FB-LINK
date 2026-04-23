<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="confirm-backdrop"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <div
        ref="panelRef"
        class="confirm-panel card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown.escape.stop.prevent="emit('cancel')"
      >
        <div class="confirm-header">
          <h3 :id="titleId" class="confirm-title">{{ title }}</h3>
        </div>
        <div class="confirm-body">
          <p class="confirm-message">{{ message }}</p>
          <slot />
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn btn-secondary btn-small" @click="emit('cancel')">
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="btn btn-small"
            :class="danger ? 'btn-danger' : 'btn-primary'"
            @click="emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Confirm' },
  message: { type: String, default: 'Are you sure?' },
  confirmText: { type: String, default: 'OK' },
  cancelText: { type: String, default: 'Cancel' },
  danger: { type: Boolean, default: false }
})

const emit = defineEmits(['confirm', 'cancel'])
const panelRef = ref(null)
const titleId = computed(() => `confirm-title-${Math.random().toString(16).slice(2)}`)

watch(
  () => props.open,
  async (v) => {
    if (!v) return
    await nextTick()
    panelRef.value?.focus?.()
  }
)

onMounted(() => {
  // no-op: keeps component predictable if mounted open in the future
})
</script>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal, 1000) + 10);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background: rgba(15, 23, 42, 0.45);
}

.confirm-panel {
  width: 100%;
  max-width: 26rem;
  padding: var(--spacing-xl);
  outline: none;
}

.confirm-header {
  margin-bottom: var(--spacing-md);
}

.confirm-title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.confirm-message {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}
</style>

