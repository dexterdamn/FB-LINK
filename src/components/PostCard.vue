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
          <div class="edit-header">
            <div>
              <h3 id="edit-title" class="edit-title">Edit post</h3>
              <p class="edit-subtitle">
                This updates the post in this app’s saved list. (Facebook Page posts may not update retroactively.)
              </p>
            </div>
            <button type="button" class="edit-close" :disabled="editSaving" aria-label="Close" @click="closeEdit">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>

          <div class="edit-body">
            <label class="edit-field">
              <span class="edit-label">Message</span>
              <textarea v-model="editContent" class="edit-textarea" rows="4" maxlength="500" />
              <span class="edit-hint">{{ (editContent || '').length }}/500</span>
            </label>
            <div class="edit-field">
              <div class="edit-image-row">
                <span class="edit-label">Media</span>
                <button
                  v-if="editMediaPreviews.length"
                  type="button"
                  class="btn btn-secondary btn-small"
                  :disabled="editSaving"
                  @click="clearEditMedia"
                >
                  Remove
                </button>
              </div>
              <ImageDropzone
                :disabled="editSaving"
                title="Click to upload images"
                subtitle="Up to 10 images only"
                accept="image/*"
                :multiple="true"
                @files-selected="onEditDropzoneFilesSelected"
              />
              <div v-if="editMediaPreviews.length" class="edit-media-list" role="list">
                <div v-for="(p, idx) in editMediaPreviews" :key="p.key" class="edit-media-row" role="listitem">
                  <div class="edit-media-thumb" aria-hidden="true">
                    <img :src="p.url" alt="" />
                  </div>

                  <div class="edit-media-meta">
                    <div class="edit-media-name" :title="p.name">{{ p.name }}</div>
                    <div class="edit-media-size">{{ formatBytes(editMediaFiles[idx]?.size) }}</div>
                  </div>

                  <div class="edit-media-actions">
                    <span class="edit-media-status" aria-hidden="true" title="Ready">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path
                          d="M20 6L9 17l-5-5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.6"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </span>

                    <button
                      type="button"
                      class="edit-media-removeBtn"
                      :disabled="editSaving"
                      aria-label="Remove image"
                      title="Remove image"
                      @click="removeEditMediaAt(idx)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M18 6L6 18M6 6l12 12"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
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
          <span class="post-time" :title="formatRelativeTime(post.createdAt)">
            {{ formatDateTime(post.createdAt) }}
          </span>
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
      <p :class="postTextSizeClass">{{ post.content }}</p>
    </div>

    <div v-if="normalizedMedia.length" class="post-media-wrap">
      <!-- Videos: show as featured/full-width -->
      <div v-if="videoMedia.length" class="post-media post-media--videos">
        <div
          v-for="(m, idx) in videoMedia"
          :key="`video_${idx}`"
          class="post-media-item post-media-item--video"
        >
          <video v-if="m.url" :src="m.url" controls playsinline class="post-media-video" />
        </div>
      </div>

      <!-- Images: single image should feel featured; otherwise collage tiles -->
      <div
        v-if="imageMedia.length"
        class="post-media post-media--images"
        :class="{ 'post-media--single': imageMedia.length === 1 && !videoMedia.length }"
      >
        <button
          v-for="(m, idx) in visibleImageMedia"
          :key="`img_${m.url}_${idx}`"
          type="button"
          class="post-media-open post-media-item"
          :class="{ 'post-media-item--single': imageMedia.length === 1 && !videoMedia.length }"
          :aria-label="`View image ${idx + 1}`"
          @click="openImageViewer(idx)"
        >
          <img :src="m.url" :alt="post.content" />
          <div
            v-if="idx === 3 && extraImageCount > 0"
            class="post-media-more"
            aria-hidden="true"
          >
            +{{ extraImageCount }}
          </div>
        </button>
      </div>

      <!-- Fallback: show Facebook embed when no local media URLs exist -->
      <div v-if="!imageMedia.length && !videoMedia.length && (facebookEmbedUrl || facebookPagePostUrl)" class="post-media post-media--embed">
        <iframe
          v-if="facebookEmbedUrl"
          class="post-media-embed"
          :src="facebookEmbedUrl"
          style="border: none; overflow: hidden"
          scrolling="no"
          frameborder="0"
          allowfullscreen="true"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        />
        <a v-else-if="facebookPagePostUrl" :href="facebookPagePostUrl" target="_blank" rel="noopener noreferrer">
          View media on Facebook
        </a>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="imageViewerOpen"
        class="image-viewer-backdrop"
        role="presentation"
        @click.self="closeImageViewer"
      >
        <div class="image-viewer" role="dialog" aria-modal="true" aria-label="Image viewer" tabindex="-1">
          <button type="button" class="image-viewer-close" aria-label="Close" @click="closeImageViewer">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M18 6L6 18M6 6l12 12"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
          </button>

          <button
            v-if="viewerImages.length > 1"
            type="button"
            class="image-viewer-nav image-viewer-prev"
            aria-label="Previous image"
            @click="prevImage"
          >
            ‹
          </button>

          <div class="image-viewer-stage">
            <img class="image-viewer-img" :src="activeViewerUrl" alt="Selected image" />
          </div>

          <button
            v-if="viewerImages.length > 1"
            type="button"
            class="image-viewer-nav image-viewer-next"
            aria-label="Next image"
            @click="nextImage"
          >
            ›
          </button>

          <div v-if="viewerImages.length > 1" class="image-viewer-count">
            {{ viewerIndex + 1 }} / {{ viewerImages.length }}
          </div>
        </div>
      </div>
    </Teleport>

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
const editMediaFiles = ref([])
const editMediaPreviews = ref([]) // { key, url, name }
const operationOverlayOpen = ref(false)
const operationOverlayTitle = ref('')
const operationOverlaySubtitle = ref('')

const imageViewerOpen = ref(false)
const viewerIndex = ref(0)

const canDelete = computed(() => props.showDeleteOption)
const canSaveEdit = computed(() => String(editContent.value || '').trim().length > 0)
const showOperationOverlay = computed(() => operationOverlayOpen.value)

const postTextSizeClass = computed(() => {
  const t = String(props.post?.content || '').trim()
  const n = t.length
  // Match Facebook feel: short posts look big, long posts slightly smaller.
  if (n <= 90) return 'post-text--large'
  if (n <= 260) return 'post-text--normal'
  return 'post-text--small'
})

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

const facebookEmbedUrl = computed(() => {
  const href = facebookPagePostUrl.value
  if (!href) return ''
  // Use Post plugin for broad compatibility (works for photo/video/text posts).
  return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(href)}&show_text=true&width=500`
})


const normalizedMedia = computed(() => {
  const m = props.post?.media
  const arr = Array.isArray(m) ? m : []
  const fromMedia = arr
    // Allow items without URL (we'll render via Facebook embed using `facebookUrl`).
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({
      kind: x.kind === 'video' ? 'video' : 'image',
      url: typeof x.url === 'string' ? String(x.url).trim() : '',
      name: typeof x.name === 'string' ? x.name : ''
    }))
  if (fromMedia.length) return fromMedia
  const img = typeof props.post?.image === 'string' ? props.post.image.trim() : ''
  return img ? [{ kind: 'image', url: img, name: '' }] : []
})

const imageMedia = computed(() =>
  normalizedMedia.value.filter((m) => m?.kind === 'image' && m?.url)
)
const videoMedia = computed(() =>
  normalizedMedia.value.filter((m) => m?.kind === 'video' && m?.url)
)
const visibleImageMedia = computed(() => imageMedia.value.slice(0, 4))
const extraImageCount = computed(() => Math.max(0, imageMedia.value.length - visibleImageMedia.value.length))

const viewerImages = computed(() => normalizedMedia.value.filter((m) => m?.kind === 'image' && m?.url))
const activeViewerUrl = computed(() => viewerImages.value?.[viewerIndex.value]?.url || '')

async function openImageViewer(idx) {
  const imgs = viewerImages.value
  if (!imgs.length) return
  const start = Math.max(0, Math.min(imgs.length - 1, Number(idx) || 0))
  viewerIndex.value = start
  imageViewerOpen.value = true
  await nextTick()
  const el = document.querySelector('.image-viewer')
  el?.focus?.()
}

function closeImageViewer() {
  imageViewerOpen.value = false
}

function prevImage() {
  const n = viewerImages.value.length
  if (n <= 1) return
  viewerIndex.value = (viewerIndex.value - 1 + n) % n
}

function nextImage() {
  const n = viewerImages.value.length
  if (n <= 1) return
  viewerIndex.value = (viewerIndex.value + 1) % n
}

function onKeyDown(e) {
  if (!imageViewerOpen.value) return
  if (e.key === 'Escape') closeImageViewer()
  else if (e.key === 'ArrowLeft') prevImage()
  else if (e.key === 'ArrowRight') nextImage()
}

const formatDateTime = (timestamp) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return String(timestamp || '')
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit'
  })
}

const formatRelativeTime = (timestamp) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return ''
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
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeyDown)
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
  editMediaFiles.value = []
  editMediaPreviews.value = []
  editOpen.value = true
  await nextTick()
  editDialogRef.value?.focus?.()
}

const closeEdit = () => {
  if (editSaving.value) return
  editOpen.value = false
  if (editPreviewObjectUrl.value) {
    try { URL.revokeObjectURL(editPreviewObjectUrl.value) } catch {}
    editPreviewObjectUrl.value = ''
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

function makeEditPreviewKey(file) {
  return `${file?.name || 'image'}_${file?.size || 0}_${file?.lastModified || Date.now()}`
}

function normalizeEditSelection(existingFiles, newFiles) {
  const existing = Array.from(existingFiles || []).filter(Boolean)
  const incoming = Array.from(newFiles || []).filter(Boolean)
  const merged = [...existing, ...incoming]
  if (!merged.length) return { files: [], error: null }
  const images = merged.filter((f) => String(f?.type || '').startsWith('image/'))
  const nonImages = merged.filter((f) => !String(f?.type || '').startsWith('image/'))
  if (nonImages.length) return { files: [], error: 'Images only. Up to 10 images only.' }
  if (images.length > 10) return { files: images.slice(0, 10), error: 'Up to 10 images only.' }
  return { files: images, error: null }
}

async function buildEditPreviewForFile(file) {
  const url = await readFileAsDataUrl(file)
  return { key: makeEditPreviewKey(file), url, name: file?.name || 'image' }
}

const onEditDropzoneFilesSelected = async (files) => {
  const { files: normalized, error } = normalizeEditSelection(editMediaFiles.value, files)
  if (error) {
    toast.error(error)
    editMediaFiles.value = normalized
  }
  editMediaFiles.value = normalized
  editMediaPreviews.value = []
  try {
    for (const f of normalized) {
      editMediaPreviews.value.push(await buildEditPreviewForFile(f))
    }
  } catch (err) {
    editMediaFiles.value = []
    editMediaPreviews.value = []
    toast.error(err?.message || 'Could not load image preview.')
  }
}

const clearEditMedia = () => {
  editMediaFiles.value = []
  editMediaPreviews.value = []
}

function removeEditMediaAt(idx) {
  const i = Number(idx)
  if (!Number.isFinite(i)) return
  editMediaFiles.value.splice(i, 1)
  editMediaPreviews.value.splice(i, 1)
}

function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const v = n / Math.pow(1024, i)
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

const saveEdit = async () => {
  const nextContent = String(editContent.value || '').trim()
  if (!nextContent) return

  editSaving.value = true
  await runWithOverlay(
    { title: 'Updating post', subtitle: 'Saving your changes…' },
    async () => {
      const id = String(props.post?.id || '')
      const isFacebookObjectId =
        typeof id === 'string' &&
        ( // feed post id: "<pageId>_<postId>"
          /^\d+_\d+$/.test(id) ||
          // video id can be numeric-only
          /^\d+$/.test(id)
        )
      const pageIdMatch = /^(\d+)_\d+$/.exec(id)
      const pageIdFromId = pageIdMatch ? pageIdMatch[1] : ''

      async function resolvePageIdForWrite() {
        if (pageIdFromId) return pageIdFromId
        try {
          const r = await fetch('/api/me', { credentials: 'include' })
          const j = await r.json().catch(() => ({}))
          const lgu = j?.lguPage?.id != null ? String(j.lguPage.id) : ''
          const selected = j?.selectedPageId != null ? String(j.selectedPageId) : ''
          return lgu || selected || ''
        } catch {
          return ''
        }
      }

      const hadExistingMedia = normalizedMedia.value.some((m) => m?.kind === 'image' || m?.kind === 'video')
      const mediaNowRemoved = hadExistingMedia && editMediaFiles.value.length === 0 && editMediaPreviews.value.length === 0

      // If this is a real Facebook Page post and user is signed in, update it on Facebook too.
      if (isFacebookObjectId && props.isAuthenticated) {
        const pageId = await resolvePageIdForWrite()

        // Removing media from an existing Facebook post is not supported.
        // Workaround: create a new TEXT post, then delete the old post.
        if (mediaNowRemoved && pageId) {
          const url = '/api/lgu/posts'

          const r = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId: String(pageId), message: nextContent })
          })
          const j = await r.json().catch(() => ({}))
          if (!r.ok || !j?.success) {
            toast.error(j?.error || `Failed to remove media on Facebook (${r.status}).`)
            return
          }

          try {
            const del = await facebookService.deletePost(id)
            if (!del?.success) {
              toast.error(del?.error || 'Removed media by creating a new Page post, but failed to delete the old one.')
            }
          } catch {
            // ignore delete errors
          }

          const newPostId = j?.postId ? String(j.postId) : ''
          const newFacebookUrl = j?.facebookUrl ? String(j.facebookUrl) : ''
          const updates = {
            content: nextContent,
            image: null,
            media: null
          }
          if (newPostId) updates.id = newPostId
          if (newFacebookUrl) updates.facebookUrl = newFacebookUrl

          const res = updatePost(props.post.id, updates)
          if (!res?.success) {
            toast.error(res?.error || 'Failed to update post.')
            return
          }

          toast.success('Media removed on LGU Page (new text post).')
          editOpen.value = false
          return
        }

        // Facebook does not support replacing media in-place.
        // If user picked new media (image/video), create a NEW media post then delete the old one.
        if (editMediaFiles.value.length && pageId) {
          const url = '/api/page/media-post'

          const fd = new FormData()
          fd.append('pageId', String(pageId))
          fd.append('message', nextContent)
          for (const f of editMediaFiles.value) {
            fd.append('media', f, f.name || 'image')
          }

          const r = await fetch(url, { method: 'POST', credentials: 'include', body: fd })
          const j = await r.json().catch(() => ({}))
          if (!r.ok || !j?.success) {
            toast.error(j?.error || `Failed to update images on Facebook (${r.status}).`)
            return
          }

          const results = Array.isArray(j?.results) ? j.results : null
          const primary = results?.[0] || j

          try {
            const del = await facebookService.deletePost(id)
            if (!del?.success) {
              toast.error(del?.error || 'Updated media by creating a new Page post, but failed to delete the old one.')
            }
          } catch {
            // ignore delete errors
          }

          const newPostId = primary?.postId ? String(primary.postId) : ''
          const newFacebookUrl = primary?.facebookUrl ? String(primary.facebookUrl) : ''
          // Locally store previews so the app can display immediately.
          const localMedia = editMediaPreviews.value.map((p) => ({ kind: 'image', url: p.url, name: p.name }))
          const updates = {
            content: nextContent,
            image: null,
            media: localMedia.length ? localMedia : null
          }
          if (newPostId) updates.id = newPostId
          if (newFacebookUrl) updates.facebookUrl = newFacebookUrl

          const res = updatePost(props.post.id, updates)
          if (!res?.success) {
            toast.error(res?.error || 'Failed to update post.')
            return
          }

          toast.success('Post updated on LGU Page (new images post).')
          editOpen.value = false
          return
        }

        // Text-only edits can be done in-place.
        // (Only for feed-style ids; video objects don't always support message edits this way.)
        if (/^\d+_\d+$/.test(id)) {
          const url = `/api/lgu/posts/${encodeURIComponent(id)}`
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
        } else {
          // For numeric-only IDs (often videos), safest path is to create a new text post.
          const pageId = await resolvePageIdForWrite()
          if (pageId) {
            const r = await fetch('/api/lgu/posts', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageId: String(pageId), message: nextContent })
            })
            const j = await r.json().catch(() => ({}))
            if (!r.ok || !j?.success) {
              toast.error(j?.error || `Failed to update on Facebook (${r.status}).`)
              return
            }
            try {
              await facebookService.deletePost(id)
            } catch {}
            const newPostId = j?.postId ? String(j.postId) : ''
            const newFacebookUrl = j?.facebookUrl ? String(j.facebookUrl) : ''
            const updates = { content: nextContent, image: null, media: null }
            if (newPostId) updates.id = newPostId
            if (newFacebookUrl) updates.facebookUrl = newFacebookUrl
            const res = updatePost(props.post.id, updates)
            if (!res?.success) {
              toast.error(res?.error || 'Failed to update post.')
              return
            }
            toast.success('Post updated on LGU Page (new text post).')
            editOpen.value = false
            return
          }
        }
      }

      // Local-only update: keep existing media unless user removed it.
      const localUpdates = { content: nextContent }
      if (hadExistingMedia && mediaNowRemoved) {
        localUpdates.image = null
        localUpdates.media = null
      }
      const res = updatePost(props.post.id, localUpdates)
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
      const isFacebookObjectId =
        typeof id === 'string' &&
        ( // feed post id: "<pageId>_<postId>"
          /^\d+_\d+$/.test(id) ||
          // video id (from /{page-id}/videos upload) can be numeric-only
          /^\d+$/.test(id)
        )

      // Always allow deleting locally (web app), even if not logged in.
      // If we can, also attempt to delete on the Facebook Page; failures should not block local deletion.
      if (isFacebookObjectId && props.isAuthenticated) {
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
  padding: 0;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-height: min(88vh, 760px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.edit-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: clamp(16px, 4vw, 22px);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
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

.edit-close {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  color: var(--text-primary);
  display: grid;
  place-items: center;
  cursor: pointer;
  line-height: 0;
  transition: transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
}

.edit-close svg {
  width: 16px;
  height: 16px;
  display: block;
}

.edit-close:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
  background: color-mix(in srgb, var(--bg-primary) 92%, transparent);
}

.edit-close:active:not(:disabled) {
  transform: translateY(0);
}

.edit-close:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 70%, white);
  outline-offset: 2px;
}

.edit-close:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.edit-body {
  padding: 14px clamp(16px, 4vw, 22px);
  overflow: auto;
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
  margin-top: auto;
  padding: 12px clamp(16px, 4vw, 22px);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  border-top: 1px solid var(--border);
  background: var(--bg-primary);
  position: sticky;
  bottom: 0;
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

.edit-media-list {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.edit-media-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  column-gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-primary);
}

.edit-media-thumb {
  width: 52px;
  height: 36px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
}

.edit-media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.edit-media-meta {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.edit-media-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.edit-media-size {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.edit-media-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.edit-media-status {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: color-mix(in srgb, var(--accent) 78%, #0f172a);
  display: grid;
  place-items: center;
}

.edit-media-status svg {
  width: 16px;
  height: 16px;
}

.edit-media-removeBtn {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
  line-height: 0;
  transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease, opacity 120ms ease;
}

.edit-media-removeBtn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bg-secondary) 90%, transparent);
  border-color: color-mix(in srgb, var(--border) 70%, var(--text-primary));
  transform: translateY(-1px);
}

.edit-media-removeBtn:active:not(:disabled) {
  transform: translateY(0);
}

.edit-media-removeBtn:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 70%, white);
  outline-offset: 2px;
}

.edit-media-removeBtn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.edit-media-removeBtn svg {
  width: 14px;
  height: 14px;
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

.post-text--large {
  font-size: 1.45rem;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.post-text--normal {
  font-size: 1.05rem;
  line-height: 1.6;
}

.post-text--small {
  font-size: 0.92rem;
  line-height: 1.55;
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

.post-media-wrap {
  margin-bottom: var(--spacing-lg);
}

.post-media {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.post-media-item {
  border-radius: var(--radius-lg);
  overflow: hidden;
  background-color: #0b1220;
  border: 1px solid var(--border);
}

.post-media-item img,
.post-media-item video {
  width: 100%;
  height: 220px;
  /* Show the whole image/video without cropping */
  object-fit: contain;
  display: block;
}

/* Videos should feel "featured" and larger than grid thumbnails */
.post-media-item--video {
  grid-column: 1 / -1;
}

.post-media-item--video video {
  height: auto;
  aspect-ratio: 16 / 9;
  max-height: min(70vh, 560px);
}

.post-media-open {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: inherit;
  overflow: hidden;
  cursor: zoom-in;
}

.post-media--images img {
  /* Collage-style tiles (like Facebook): fill the tile */
  object-fit: cover;
}

.post-media--single {
  grid-template-columns: 1fr;
}

.post-media-item--single img {
  height: auto;
  aspect-ratio: 16 / 9;
  max-height: min(72vh, 620px);
  object-fit: cover;
}

.post-media-more {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(2, 6, 23, 0.55);
  color: rgba(255, 255, 255, 0.95);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-size: clamp(1.6rem, 4.2vw, 2.6rem);
  text-shadow: 0 10px 22px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(1px);
}

.post-media-open:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 70%, white);
  outline-offset: 2px;
}

.image-viewer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1600;
  background: rgba(15, 23, 42, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.image-viewer {
  position: relative;
  /* Bigger viewer so large images can be seen clearly */
  width: min(1320px, 96vw);
  height: min(92vh, 860px);
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  /* Keep large images from overflowing the rounded box */
  overflow: hidden;
  /* Use border-box so padding reduces the available inner area correctly */
  box-sizing: border-box;
  /* Consistent breathing room around the image (top and bottom) */
  padding: 44px 52px;
  outline: none;
}

.image-viewer-stage {
  width: 100%;
  flex: 1 1 auto;
  display: grid;
  place-items: center;
  min-height: 0;
}

.image-viewer-img {
  /* Always show the whole image (no cropping) */
  object-fit: contain;
  /* Bound the image to the viewport */
  max-width: 96vw;
  max-height: 92vh;
  /* No fixed height/width — let it scale down naturally */
  width: auto;
  height: auto;
  display: block;
  user-select: none;
}

.image-viewer-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.65);
  color: white;
  display: grid;
  place-items: center;
  line-height: 0;
}

.image-viewer-close svg {
  width: 18px;
  height: 18px;
  display: block;
}

.image-viewer-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.55);
  color: white;
  font-size: 28px;
  padding: 0;
  display: grid;
  place-items: center;
}

.image-viewer-prev {
  left: 14px;
}

.image-viewer-next {
  right: 14px;
}

@media (max-width: 520px) {
  .image-viewer {
    padding: 52px 18px;
  }
}

.image-viewer-count {
  position: static;
  font-size: 0.9rem;
  color: rgba(226, 232, 240, 0.9);
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.25);
  padding: 6px 10px;
  border-radius: 999px;
}

.post-media-video {
  background: #000;
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

  .post-media {
    grid-template-columns: 1fr;
  }

  .post-media-item img,
  .post-media-item video {
    height: 240px;
  }
}
</style>
