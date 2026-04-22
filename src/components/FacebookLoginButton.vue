<template>
  <button
    type="button"
    class="facebook-login-btn"
    :disabled="isLoading || sdkPreparing"
    @click="$emit('click')"
  >
    <svg
      v-if="!isLoading && !sdkPreparing"
      class="facebook-login-btn__icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
    <span v-if="isLoading || sdkPreparing" class="spinner" aria-hidden="true"></span>
    <span>{{ buttonLabel }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  },
  sdkPreparing: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click'])

const buttonLabel = computed(() => {
  if (props.isLoading) return 'Opening Facebook…'
  if (props.sdkPreparing) return 'Inihahanda ang Facebook…'
  return 'Continue with Facebook'
})
</script>

<style scoped>
.facebook-login-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  background-color: #1f2937;
  color: white;
  transition: background-color 0.2s ease;
}

.facebook-login-btn:hover:not(:disabled) {
  background-color: #111827;
}

.facebook-login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.facebook-login-btn__icon {
  flex-shrink: 0;
}
</style>
