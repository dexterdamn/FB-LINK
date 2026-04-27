<template>
  <div class="image-dropzone">
    <input
      :id="inputId"
      ref="inputRef"
      class="image-dropzone__input"
      type="file"
      accept="image/*"
      :disabled="disabled"
      @change="onInputChange"
    />

    <label
      class="image-dropzone__box"
      :class="{ 'image-dropzone__box--disabled': disabled, 'image-dropzone__box--dragging': isDragging }"
      :for="inputId"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div class="image-dropzone__inner" aria-hidden="true">
        <div class="image-dropzone__iconWrap">
          <svg
            class="image-dropzone__icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 16V4m0 0 4 4m-4-4-4 4"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M4 16.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2.5"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="image-dropzone__text">
          <div class="image-dropzone__title">{{ title }}</div>
          <div class="image-dropzone__subtitle">{{ subtitle }}</div>
        </div>
      </div>
    </label>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  title: { type: String, default: 'Click to upload an image' },
  subtitle: { type: String, default: 'PNG, JPG, GIF — up to 10MB' }
})

const emit = defineEmits(['file-selected'])

const inputRef = ref(null)
const isDragging = ref(false)
const inputId = computed(() => `imgdz_${Math.random().toString(16).slice(2)}`)

function emitFile(file) {
  if (!file) return
  emit('file-selected', file)
}

function onInputChange(e) {
  const file = e?.target?.files?.[0]
  emitFile(file)
}

function onDragEnter() {
  if (props.disabled) return
  isDragging.value = true
}
function onDragOver() {
  if (props.disabled) return
  isDragging.value = true
}
function onDragLeave() {
  isDragging.value = false
}
function onDrop(e) {
  if (props.disabled) return
  isDragging.value = false
  const file = e?.dataTransfer?.files?.[0]
  emitFile(file)
  // Reset the input so choosing the same file again triggers change.
  if (inputRef.value) inputRef.value.value = ''
}
</script>

<style scoped>
.image-dropzone__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.image-dropzone__box {
  width: 100%;
  min-height: 108px;
  border: 2px dashed color-mix(in srgb, var(--divider) 70%, transparent);
  border-radius: 14px;
  background: var(--bg-secondary);
  display: grid;
  place-items: center;
  padding: 18px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}

.image-dropzone__box:hover {
  background: color-mix(in srgb, var(--bg-secondary) 65%, white);
  border-color: color-mix(in srgb, var(--accent) 55%, var(--divider));
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
}

.image-dropzone__box--dragging {
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-secondary));
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14);
}

.image-dropzone__box--disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.image-dropzone__inner {
  display: grid;
  gap: 10px;
  text-align: center;
  justify-items: center;
}

.image-dropzone__iconWrap {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--bg-tertiary) 70%, white);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.image-dropzone__icon {
  width: 22px;
  height: 22px;
}

.image-dropzone__title {
  font-weight: 650;
  color: var(--text-primary);
  font-size: 0.98rem;
  letter-spacing: -0.01em;
}

.image-dropzone__subtitle {
  margin-top: 3px;
  font-size: 0.86rem;
  color: var(--text-secondary);
}

@media (max-width: 420px) {
  .image-dropzone__box {
    min-height: 96px;
    padding: 16px;
  }
}
</style>

