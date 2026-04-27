<template>
  <div class="post-card card hover-shadow">
    <Teleport to="body">
      <div v-if="showOperationOverlay" class="fullscreen-loading" role="status" aria-live="polite">
        <div class="fullscreen-loading__panel" role="presentation">
          <div class="fullscreen-loading__spinnerWrap" aria-hidden="true">
            <span class="fullscreen-loading__spinner"></span>
          </div>
          <div class="fullscreen-loading__content">
            <div class="fullscreen-loading__title">{{ operationOverlayTitle }}</div>
            <div class="fullscreen-loading__subtitle">{{ operationOverlaySubtitle }}</div>
          </div>
        </div>
      </div>
    </Teleport>
    <ConfirmDialog
      :open="deleteConfirmOpen"
      title="Delete post?"
      message="This will remove the post from this app. If you are logged in and the post is linked to Facebook, we’ll also attempt to delete it on the Page."
      confirm-text="Delete"
      cancel-text="Cancel"
      :danger="true"
      @confirm="confirmDelete"
      @cancel="deleteConfirmOpen = false"
    />
    <Teleport to="body">
      <div v-if="editOpen" class="edit-backdrop" role="presentation" @click.self="closeEdit">
        <div
          class="edit-dialog card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-title"
          tabindex="-1"
          ref="editDialogRef"
        >
          <h3 id="edit-title" class="edit-title">Edit post</h3>
          <p class="edit-subtitle">
            This updates the post in this app’s saved list. (Facebook Page posts may not update retroactively.)
          </p>
          <label class="edit-field">
            <span class="edit-label">Message</span>
            <textarea v-model="editContent" class="edit-textarea" rows="5" maxlength="500" />
            <span class="edit-hint">{{ (editContent || '').length }}/500</span>
          </label>
          <div class="edit-field">
            <div class="edit-image-row">
              <span class="edit-label">Image</span>
              <button
                v-if="editImagePreviewUrl"
                type="button"
                class="btn btn-secondary btn-small"
                :disabled="editSaving"
                @click="clearEditImage"
              >
                Remove
              </button>
            </div>
            <ImageDropzone
              :disabled="editSaving"
              title="Click to upload an image"
              subtitle="PNG, JPG, GIF — up to 10MB"
              @file-selected="onEditDropzoneFileSelected"
            />
            <div v-if="editImagePreviewUrl" class="edit-preview">
              <img :src="editImagePreviewUrl" alt="Selected image preview" />
            </div>
          </div>
          <div class="edit-actions">
            <button type="button" class="btn btn-secondary" :disabled="editSaving" @click="closeEdit">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" :disabled="editSaving || !canSaveEdit" @click="saveEdit">
              {{ editSaving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <div class="post-header">
      <div class="post-user-info">
        <!-- Temporarily hidden: user avatar + name -->
        <!-- <img :src="userAvatar" :alt="userName" class="avatar" /> -->
        <!-- <h4 class="user-name">{{ userName }}</h4> -->
        <div class="user-details">
          <span class="post-time">{{ formatTime(post.createdAt) }}</span>
        </div>
      </div>
      <div v-if="canDelete" class="post-menu-wrap" ref="menuWrapRef">
        <button
          type="button"
          class="kebab-btn"
          @click.stop="toggleMenu"
          aria-haspopup="menu"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          title="Post options"
        >
          ⋮
        </button>
        <div v-if="menuOpen" class="post-menu" role="menu">
          <button type="button" class="menu-item" role="menuitem" @click="handleEdit">
            Edit
          </button>
          <button type="button" class="menu-item menu-delete" role="menuitem" @click="handleDelete">
            Delete
          </button>
        </div>
      </div>
    </div>

    <div class="post-content">
      <p>{{ post.content }}</p>
    </div>

    <div v-if="post.image" class="post-image">
      <img :src="post.image" :alt="post.content" />
    </div>

    <div class="post-stats">
      <span v-if="(post.likes ?? 0) > 0" class="stat">
        <!-- <span class="stat-icon">👍</span> -->
        {{ post.likes }} likes
      </span>
    </div>

    <div class="divider"></div>

    <div class="post-actions">
      <!-- Like action hidden for now -->
      <!--
      <button
        class="action-btn"
        :class="{ 'liked': isLiked }"
        @click="handleLike"
      >
        Like
      </button>
      -->
      <a
        v-if="facebookPagePostUrl"
        :href="facebookPagePostUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="action-btn facebook-link"
      >
        <span class="action-icon">f</span>
        Open Page post
      </a>
      <span
        v-else
        class="action-btn facebook-link facebook-page-link-placeholder"
        title="Posts published from this app appear on your Facebook Page, not your personal profile. Older saved posts may not have a Page permalink stored."
      >
        <span class="action-icon">f</span>
        No Page link
      </span>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { usePostStore } from '../composables/usePostStore'
import { facebookService } from '../services/facebookService'
import { useToast } from '../composables/useToast'
import ConfirmDialog from './ConfirmDialog.vue'
import ImageDropzone from './ImageDropzone.vue'

const props = defineProps({
  post: {
    type: Object,
    required: true
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  userName: {
    type: String,
    default: 'User'
  },
  userAvatar: {
    type: String,
    default: 'https://via.placeholder.com/40'
  },
  showDeleteOption: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['post-deleted'])
const { updatePost } = usePostStore()
const toast = useToast()

const menuOpen = ref(false)
const isLiked = ref(false)
const menuWrapRef = ref(null)
const deleteConfirmOpen = ref(false)
const editOpen = ref(false)
const editContent = ref('')
const editSaving = ref(false)
const editDialogRef = ref(null)
const editImageFile = ref(null)
const editImagePreviewUrl = ref('')
const operationOverlayOpen = ref(false)
const operationOverlayTitle = ref('')
const operationOverlaySubtitle = ref('')

const canDelete = computed(() => props.showDeleteOption)
const canSaveEdit = computed(() => String(editContent.value || '').trim().length > 0)
const showOperationOverlay = computed(() => operationOverlayOpen.value)

async function runWithOverlay(
  { title, subtitle, minMs = 2000 },
  fn
) {
  operationOverlayTitle.value = title
  operationOverlaySubtitle.value = subtitle
  operationOverlayOpen.value = true
  const startedAt = performance.now()
  await nextTick()

  try {
    return await fn()
  } finally {
    const elapsedMs = performance.now() - startedAt
    const remainingMs = Math.max(0, minMs - elapsedMs)
    if (remainingMs) await new Promise((r) => window.setTimeout(r, remainingMs))
    operationOverlayOpen.value = false
  }
}

/** Permalink to the post on the Facebook Page (Graph returns pageId_postId). No personal-timeline sharer. */
const facebookPagePostUrl = computed(() => {
  const u = props.post?.facebookUrl
  return typeof u === 'string' && u.trim() ? u.trim() : ''
})


const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
}

function closeMenus() {
  menuOpen.value = false
}

function onDocumentPointerDown(e) {
  const wrap = menuWrapRef.value
  if (!wrap) return
  const target = e?.target
  if (target && wrap.contains(target)) return
  closeMenus()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

const handleDelete = async () => {
  if (!canDelete.value) {
    menuOpen.value = false
    return
  }
  menuOpen.value = false
  deleteConfirmOpen.value = true
}

const handleEdit = async () => {
  menuOpen.value = false
  editContent.value = String(props.post?.content || '')
  editImageFile.value = null
  editImagePreviewUrl.value = typeof props.post?.image === 'string' ? props.post.image : ''
  editOpen.value = true
  await nextTick()
  editDialogRef.value?.focus?.()
}

const closeEdit = () => {
  if (editSaving.value) return
  editOpen.value = false
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

const onEditDropzoneFileSelected = async (file) => {
  if (!file) return
  editImageFile.value = file
  try {
    editImagePreviewUrl.value = await readFileAsDataUrl(file)
  } catch (err) {
    editImageFile.value = null
    editImagePreviewUrl.value = ''
    toast.error(err?.message || 'Could not load image preview.')
  }
}

const clearEditImage = () => {
  editImageFile.value = null
  editImagePreviewUrl.value = ''
}

const saveEdit = async () => {
  const nextContent = String(editContent.value || '').trim()
  if (!nextContent) return

  editSaving.value = true
  await runWithOverlay(
    { title: 'Updating post', subtitle: 'Saving your changes…' },
    async () => {
      const id = String(props.post?.id || '')
      const looksLikeGraphPost = typeof id === 'string' && /^\d+_\d+$/.test(id)
      const pageIdMatch = /^(\d+)_\d+$/.exec(id)
      const pageId = pageIdMatch ? pageIdMatch[1] : ''
      const hadLocalImage = typeof props.post?.image === 'string' && String(props.post.image).trim().length > 0
      const imageNowRemoved = hadLocalImage && !editImageFile.value && !String(editImagePreviewUrl.value || '').trim()

      // If this is a real Facebook Page post and user is signed in, update it on Facebook too.
      if (looksLikeGraphPost && props.isAuthenticated) {
        // Removing an image from an existing Facebook post is not supported.
        // Workaround: create a new TEXT post without image, then delete the old post.
        if (imageNowRemoved && pageId) {
          const base = String(import.meta.env.BASE_URL || '/')
          const cleanBase = base.endsWith('/') ? base : `${base}/`
          const url = `${cleanBase}api/lgu/posts`

          const r = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId: String(pageId), message: nextContent })
          })
          const j = await r.json().catch(() => ({}))
          if (!r.ok || !j?.success) {
            toast.error(j?.error || `Failed to remove image on Facebook (${r.status}).`)
            return
          }

          try {
            const del = await facebookService.deletePost(id)
            if (!del?.success) {
              toast.error(del?.error || 'Removed image by creating a new Page post, but failed to delete the old one.')
            }
          } catch {
            // ignore delete errors
          }

          const newPostId = j?.postId ? String(j.postId) : ''
          const newFacebookUrl = j?.facebookUrl ? String(j.facebookUrl) : ''
          const updates = {
            content: nextContent,
            image: null
          }
          if (newPostId) updates.id = newPostId
          if (newFacebookUrl) updates.facebookUrl = newFacebookUrl

          const res = updatePost(props.post.id, updates)
          if (!res?.success) {
            toast.error(res?.error || 'Failed to update post.')
            return
          }

          toast.success('Image removed on LGU Page (new text post).')
          editOpen.value = false
          return
        }

        // Facebook does not support replacing an image in-place on an existing post.
        // If the user picked a new image, create a NEW photo post on the LGU Page,
        // then (best-effort) delete the old post.
        if (editImageFile.value && pageId) {
          const base = String(import.meta.env.BASE_URL || '/')
          const cleanBase = base.endsWith('/') ? base : `${base}/`
          const url = `${cleanBase}api/page/photo-post`

          const fd = new FormData()
          fd.append('pageId', String(pageId))
          fd.append('message', nextContent)
          fd.append('image', editImageFile.value, editImageFile.value.name || 'photo.jpg')

          const r = await fetch(url, { method: 'POST', credentials: 'include', body: fd })
          const j = await r.json().catch(() => ({}))
          if (!r.ok || !j?.success) {
            toast.error(j?.error || `Failed to update image on Facebook (${r.status}).`)
            return
          }

          try {
            const del = await facebookService.deletePost(id)
            if (!del?.success) {
              toast.error(del?.error || 'Updated image by creating a new Page post, but failed to delete the old one.')
            }
          } catch {
            // ignore delete errors
          }

          const newPostId = j?.postId ? String(j.postId) : ''
          const newFacebookUrl = j?.facebookUrl ? String(j.facebookUrl) : ''
          const updates = {
            content: nextContent,
            image: editImagePreviewUrl.value || null
          }
          if (newPostId) updates.id = newPostId
          if (newFacebookUrl) updates.facebookUrl = newFacebookUrl

          const res = updatePost(props.post.id, updates)
          if (!res?.success) {
            toast.error(res?.error || 'Failed to update post.')
            return
          }

          toast.success('Post updated on LGU Page (new photo post).')
          editOpen.value = false
          return
        }

        // Text-only edits can be done in-place.
        const base = String(import.meta.env.BASE_URL || '/')
        const cleanBase = base.endsWith('/') ? base : `${base}/`
        const url = `${cleanBase}api/lgu/posts/${encodeURIComponent(id)}`
        const r = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: nextContent })
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j?.success) {
          toast.error(j?.error || `Failed to edit on Facebook (${r.status}).`)
          return
        }
      }

      const res = updatePost(props.post.id, { content: nextContent, image: editImagePreviewUrl.value || null })
      if (!res?.success) {
        toast.error(res?.error || 'Failed to update post.')
        return
      }
      toast.success('Post updated.')
      editOpen.value = false
    }
  ).finally(() => {
    editSaving.value = false
  })
}

const confirmDelete = async () => {
  deleteConfirmOpen.value = false
  const id = props.post.id

  await runWithOverlay(
    { title: 'Deleting post', subtitle: 'Removing this post…' },
    async () => {
      // Facebook Graph Page posts look like "<numericPageId>_<numericPostId>".
      // Local app IDs also contain "_" (e.g. "post_123"), so use a strict numeric check.
      const looksLikeGraphPost = typeof id === 'string' && /^\d+_\d+$/.test(id)

      // Always allow deleting locally (web app), even if not logged in.
      // If we can, also attempt to delete on the Facebook Page; failures should not block local deletion.
      if (looksLikeGraphPost && props.isAuthenticated) {
        const res = await facebookService.deletePost(id)
        if (!res.success) {
          toast.error(res.error || 'Deleted in the app, but failed to delete on Facebook.')
        }
      }

      emit('post-deleted', id)
    }
  )
}

const handleLike = () => {
  isLiked.value = !isLiked.value
  const newLikes = isLiked.value ? props.post.likes + 1 : props.post.likes - 1
  updatePost(props.post.id, { likes: newLikes })
}

</script>

<style scoped>
.edit-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  z-index: 1200;
}

.edit-dialog {
  width: min(620px, 100%);
  padding: clamp(16px, 4vw, 22px);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.edit-title {
  margin: 0 0 6px 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.edit-subtitle {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.35;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.edit-textarea {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.5;
  font-family: inherit;
}

.edit-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.edit-hint {
  display: block;
  text-align: right;
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.edit-actions {
  margin-top: var(--spacing-lg);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.edit-image-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.edit-preview {
  margin-top: 10px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  background-color: var(--bg-tertiary);
}

.edit-preview img {
  width: 100%;
  height: auto;
  max-height: 360px;
  object-fit: cover;
  display: block;
}

.post-card {
  margin-bottom: var(--spacing-lg);
}

.post-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
  position: relative;
}

.post-menu-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.kebab-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--border);
  background-color: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  line-height: 1;
  font-size: 18px;
}

.kebab-btn:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.kebab-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}

.post-user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.post-time {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.post-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background-color: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: var(--z-dropdown);
  min-width: 150px;
  overflow: hidden;
  margin-top: var(--spacing-sm);
}

.menu-item {
  display: block;
  width: 100%;
  padding: var(--spacing-md);
  border: none;
  background: none;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: 0.95rem;
}

.menu-item:hover {
  background-color: var(--bg-secondary);
}

.menu-delete {
  color: var(--error);
}

.menu-delete:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.post-content {
  margin-bottom: var(--spacing-lg);
  word-wrap: break-word;
  white-space: pre-wrap;
}

.post-content p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--text-primary);
}

.post-image {
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background-color: var(--bg-tertiary);
}

.post-image img {
  width: 100%;
  height: auto;
  max-height: 400px;
  object-fit: cover;
}

.post-stats {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.stat-icon {
  font-size: 1rem;
}

.post-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  text-decoration: none;
}

.action-btn:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.action-btn.liked {
  color: var(--accent);
}

.action-icon {
  font-size: 1.1rem;
}

.facebook-link {
  text-decoration: none;
}

.facebook-page-link-placeholder {
  cursor: default;
  opacity: 0.72;
  pointer-events: none;
}

/* Share UI removed */

@media (max-width: 480px) {
  .post-actions {
    grid-template-columns: 1fr;
  }
}
</style>
