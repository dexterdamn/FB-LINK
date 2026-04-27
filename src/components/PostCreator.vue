<template>
  <div class="post-creator card hover-shadow">
    <div class="creator-header">
      <h2 class="creator-title">Create Post</h2>
      <span v-if="!isAuthenticated" class="creator-hint">Step 1: Sign in with Facebook.</span>
      <span v-else-if="publishablePages.length" class="creator-hint creator-hint-logged">
        Step 2: Create a post here. It will be published to the Facebook Page
        <strong>{{ confirmTargetPageName }}</strong>
        <template v-if="publishablePages.length > 1"> (choose from the dropdown below)</template>.
      </span>
    </div>

    <div
      v-if="isAuthenticated && !publishablePages.length"
      class="page-missing-banner"
      role="alert"
    >
      <p class="page-missing-title">Walang Facebook Page na naka-load sa session mo.</p>
      <p class="page-missing-text">
        Kaya walang dropdown: kailangan ng Facebook login na may permiso para sa mga Page na pinamamahalaan mo
        (<code>pages_show_list</code>, <code>pages_manage_posts</code>).
      </p>
      <p v-if="authScopeDebug" class="page-missing-debug">
        <span class="page-missing-debug-label">Debug (mula sa huling login):</span><br />
        {{ authScopeDebug }}
      </p>
      <div class="page-missing-actions">
        <button type="button" class="btn btn-primary btn-small" @click="reconnectFacebookForPages">
          Ayusin ang Page access — mag-login muli sa Facebook
        </button>
      </div>
      <ol class="page-missing-steps">
        <li>
          Pindutin ang button sa itaas (mag-<strong>logout</strong> at bubuksan ang Facebook na may
          <code>auth_type=rerequest</code>) — <strong>piliin / payagan ang lahat</strong> ng access para sa Pages.
        </li>
        <li>Sa <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer">Meta App Dashboard</a>: naka-enable ang <code>pages_show_list</code> at <code>pages_manage_posts</code> (Use cases → Pages).</li>
        <li>I-restart ang API pagkatapos baguhin ang <code>.env</code>; tiyaking may laman ang <code>FACEBOOK_LOGIN_SCOPES</code> kasama ang Page scopes.</li>
      </ol>
    </div>

    <div v-if="isAuthenticated && publishablePages.length" class="page-target">
      <label v-if="publishablePages.length > 1" class="field page-target-field">
        <span class="label">Facebook Page</span>
        <select
          v-model="publishTargetPageId"
          class="select"
          :disabled="isSubmitting"
          @change="syncPublishPage"
        >
          <option v-for="p in publishablePages" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <span class="meta">This post will appear on the Page you select.</span>
      </label>
      <p v-else class="page-target-single">
        Posting to <strong>{{ publishablePages[0].name }}</strong>
      </p>
    </div>

    <form class="creator-form" @submit.prevent="handleSubmit">
      <label class="field">
        <span class="label">Message</span>
        <textarea
          v-model="content"
          class="textarea"
          :disabled="isSubmitting"
          :maxlength="maxChars"
          rows="4"
          placeholder="What do you want to share?"
        />
        <span class="meta">{{ content.length }}/{{ maxChars }}</span>
      </label>

      <div class="field">
        <div class="field-row">
          <span class="label">Image</span>
          <button
            v-if="imageFile || imagePreviewUrl"
            type="button"
            class="btn btn-small"
            :disabled="isSubmitting"
            @click="clearImage"
          >
            Remove
          </button>
        </div>

        <ImageDropzone
          :disabled="isSubmitting || !isAuthenticated"
          title="Click to upload an image"
          subtitle="PNG, JPG, GIF — up to 10MB"
          @file-selected="onDropzoneFileSelected"
        />

        <div v-if="imagePreviewUrl" class="preview">
          <img :src="imagePreviewUrl" alt="Selected image preview" />
        </div>
      </div>

      <div class="actions">
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="!canSubmit"
        >
          <span v-if="isSubmitting">Publishing…</span>
          <span v-else>Post</span>
        </button>
      </div>
    </form>

    <Teleport to="body">
      <div
        v-if="showPublishConfirm"
        class="publish-confirm-backdrop"
        role="presentation"
        @click.self="cancelPublishConfirm"
      >
        <div
          ref="publishConfirmPanelRef"
          class="publish-confirm-dialog card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-confirm-title"
          tabindex="-1"
          @keydown.escape.stop.prevent="cancelPublishConfirm"
        >
          <h3 id="publish-confirm-title" class="publish-confirm-title">Post to Facebook Page?</h3>
          <p v-if="confirmTargetPageFacebookUrl" class="publish-confirm-page-link-wrap">
            <a
              :href="confirmTargetPageFacebookUrl"
              class="publish-confirm-page-link"
              target="_blank"
              rel="noopener noreferrer"
              @click.stop
            >
              Open the Page on Facebook (new tab)
            </a>
          </p>
          <div v-if="content.trim()" class="publish-confirm-preview">
            <span class="publish-confirm-preview-label">Message</span>
            <p class="publish-confirm-preview-body">{{ contentPreview }}</p>
          </div>
          <p v-if="imageFile" class="publish-confirm-note">This post includes an image.</p>
          <div class="publish-confirm-actions">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="isSubmitting"
              @click="cancelPublishConfirm"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="isSubmitting"
              @click="confirmPublish"
            >
              {{ isSubmitting ? 'Publishing…' : 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { facebookService } from '../services/facebookService'
import { useFacebookAuth } from '../composables/useFacebookAuth'
import { useToast } from '../composables/useToast'
import ImageDropzone from './ImageDropzone.vue'

const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    required: true
  },
  user: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['post-created'])

const toast = useToast()
const { logout: authLogout } = useFacebookAuth()

/** Log out session then open Facebook OAuth with re-request so skipped Page permissions appear again. */
async function reconnectFacebookForPages() {
  await authLogout()
  window.location.assign('/auth/facebook/login?auth_type=rerequest')
}

const maxChars = 500
const content = ref('')
const imageFile = ref(null)
const imagePreviewUrl = ref('')
const isSubmitting = ref(false)
const fileInput = ref(null)
const showPublishConfirm = ref(false)
const publishConfirmPanelRef = ref(null)
const serverConfig = ref({ publishingMode: 'oauth', targetPage: null })
const configLoading = ref(true)

onMounted(async () => {
  try {
    const r = await fetch('/api/config')
    const j = await r.json().catch(() => null)
    if (r.ok && j?.success) {
      serverConfig.value = {
        publishingMode: j.publishingMode || 'oauth',
        targetPage: j.targetPage || null
      }
    }
  } catch {
    // ignore config load errors; UI will fallback to OAuth mode
  } finally {
    configLoading.value = false
  }
})

watch(showPublishConfirm, async (open) => {
  if (!open) return
  await nextTick()
  publishConfirmPanelRef.value?.focus?.()
})

const publishablePages = computed(() => {
  const pages = props.user?.pages
  return Array.isArray(pages) ? pages : []
})

const serverTokenModeEnabled = computed(() => serverConfig.value?.publishingMode === 'server_token')
const serverTargetPageName = computed(() => serverConfig.value?.targetPage?.name || 'LGU Page')

// Posting is only allowed when logged in (even if server-token mode is configured).
const usingGuestPublishMode = computed(() => false)

/** Shows what Meta granted vs requested — helps when user is "logged in" but Pages list is empty. */
const authScopeDebug = computed(() => {
  const a = props.user?.authentication
  if (!a) return ''
  const req = typeof a.requestedScopes === 'string' ? a.requestedScopes : ''
  const gr = Array.isArray(a.grantedPermissions) ? a.grantedPermissions.join(', ') : ''
  if (!req && !gr) return ''
  return `Hiniling na scopes: ${req || '(unknown)'}\nNa-grant: ${gr || '(wala — kailangan payagan sa Facebook dialog)'}` 
})

const publishTargetPageId = ref('')

watch(
  () => props.user,
  (u) => {
    if (!u?.pages?.length) {
      publishTargetPageId.value = ''
      return
    }
    const id = u.selectedPageId || u.pages[0]?.id || ''
    publishTargetPageId.value = String(id)
    if (id) facebookService.setSelectedPage(String(id))
  },
  { immediate: true }
)

function syncPublishPage() {
  const id = publishTargetPageId.value
  if (!id) return
  const ok = facebookService.setSelectedPage(String(id))
  if (!ok) toast.error('Could not use that Page for publishing.')
}

const canSubmit = computed(() => {
  if (isSubmitting.value) return false
  if (showPublishConfirm.value) return false
  const hasText = content.value.trim().length > 0
  const hasImage = !!imageFile.value
  if (usingGuestPublishMode.value) return hasText || hasImage
  if (!props.isAuthenticated) return false
  if (!publishablePages.value.length) return false
  return hasText || hasImage
})

const confirmTargetPageName = computed(() => {
  if (usingGuestPublishMode.value) return serverTargetPageName.value
  const id = publishTargetPageId.value
  const p = publishablePages.value.find((x) => String(x.id) === String(id))
  return p?.name || 'your Facebook Page'
})

const viewerDisplayName = computed(() => props.user?.name || 'User')

/** Opens the Page on facebook.com (numeric Page id works in the browser). */
const confirmTargetPageFacebookUrl = computed(() => {
  const id =
    publishTargetPageId.value ||
    (props.user?.selectedPageId != null ? String(props.user.selectedPageId) : '') ||
    (props.user?.pages?.[0]?.id != null ? String(props.user.pages[0].id) : '')
  if (!id) return ''
  return `https://www.facebook.com/${encodeURIComponent(id)}`
})

const contentPreview = computed(() => {
  const t = content.value.trim()
  if (t.length <= 220) return t
  return `${t.slice(0, 220)}…`
})

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

const onFileChange = async (e) => {
  const file = e?.target?.files?.[0]
  if (!file) return
  imageFile.value = file
  try {
    imagePreviewUrl.value = await readFileAsDataUrl(file)
  } catch (err) {
    imageFile.value = null
    imagePreviewUrl.value = ''
    toast.error(err?.message || 'Could not load image preview.')
  }
}

const onDropzoneFileSelected = async (file) => {
  if (!file) return
  if (fileInput.value) fileInput.value.value = ''
  imageFile.value = file
  try {
    imagePreviewUrl.value = await readFileAsDataUrl(file)
  } catch (err) {
    imageFile.value = null
    imagePreviewUrl.value = ''
    toast.error(err?.message || 'Could not load image preview.')
  }
}

const clearImage = () => {
  imageFile.value = null
  imagePreviewUrl.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

const reset = () => {
  content.value = ''
  clearImage()
}

function cancelPublishConfirm() {
  if (isSubmitting.value) return
  showPublishConfirm.value = false
}

const handleSubmit = () => {
  if (!props.isAuthenticated && !serverTokenModeEnabled.value) {
    toast.error('Please log in to publish posts (or configure server Page token in .env).')
    return
  }

  if (props.isAuthenticated && !publishablePages.value.length) {
    toast.error(
      'Walang Facebook Page sa session. Mag-logout, ayusin ang Page permissions sa Meta / .env, tapos mag-login muli.'
    )
    return
  }

  const message = content.value.trim()
  if (!message && !imageFile.value) {
    toast.error('Write something or add an image first.')
    return
  }

  showPublishConfirm.value = true
}

async function confirmPublish() {
  const message = content.value.trim()
  if (!message && !imageFile.value) {
    toast.error('Write something or add an image first.')
    showPublishConfirm.value = false
    return
  }

  const guestMode = usingGuestPublishMode.value
  if (!guestMode && !props.isAuthenticated) {
    showPublishConfirm.value = false
    return
  }

  let pageId = ''
  if (!guestMode) {
    pageId =
      publishTargetPageId.value ||
      (props.user?.selectedPageId != null ? String(props.user.selectedPageId) : '') ||
      (props.user?.pages?.[0]?.id != null ? String(props.user.pages[0].id) : '')

    const pages = Array.isArray(props.user?.pages) ? props.user.pages : []
    const pageOk = pages.some((p) => String(p.id) === String(pageId))
    if (!pageId || !pageOk) {
      toast.error(
        'Pumili ng Facebook Page sa dropdown, o mag-login muli (kailangan ang Page sa session: pages_show_list, pages_manage_posts).'
      )
      return
    }

    if (props.user) {
      facebookService.hydrateFromUser(props.user)
      facebookService.setSelectedPage(String(pageId))
    }
  } else if (!serverTokenModeEnabled.value) {
    toast.error('Server Page token is not configured.')
    return
  }

  isSubmitting.value = true
  try {
    const base = String(import.meta.env.BASE_URL || '/')
    const cleanBase = base.endsWith('/') ? base : `${base}/`
    let publishRes
    if (imageFile.value) {
      const fd = new FormData()
      if (!guestMode) fd.append('pageId', String(pageId))
      fd.append('message', message)
      fd.append('image', imageFile.value, imageFile.value.name || 'photo.jpg')
      const url = guestMode ? `${cleanBase}api/server/page/photo-post` : `${cleanBase}api/page/photo-post`
      const res = await fetch(url, {
        method: 'POST',
        credentials: guestMode ? 'omit' : 'include',
        body: fd
      })
      const data = await res.json().catch(() => ({}))
      publishRes =
        res.ok && data.success
          ? { success: true, postId: data.postId, facebookUrl: data.facebookUrl }
          : { success: false, error: data.error || `Publish failed (${res.status}).` }
    } else {
      const url = guestMode ? `${cleanBase}api/server/page/post` : `${cleanBase}api/lgu/posts`
      const res = await fetch(url, {
        method: 'POST',
        credentials: guestMode ? 'omit' : 'include',
        headers: { 'Content-Type': 'application/json' },
        body: guestMode ? JSON.stringify({ message }) : JSON.stringify({ pageId: String(pageId), message })
      })
      const data = await res.json().catch(() => ({}))
      publishRes =
        res.ok && data.success
          ? { success: true, postId: data.postId, facebookUrl: data.facebookUrl }
          : { success: false, error: data.error || `Publish failed (${res.status}).` }
    }

    emit('post-created', {
      id: publishRes.postId || undefined,
      content: message,
      image: imagePreviewUrl.value || null,
      createdAt: new Date().toISOString(),
      likes: 0,
      shares: 0,
      comments: [],
      facebookUrl: publishRes.facebookUrl || null
    })

    if (!publishRes?.success) {
      toast.error(publishRes?.error || 'Saved in app, but failed to publish to Facebook Page.')
    } else {
      toast.success(
        `Success: na-post na sa Facebook Page na "${confirmTargetPageName.value}". Buksan ang Page para tingnan ang Posts.`,
        { durationMs: 6500 }
      )
      const fbUrl = typeof publishRes.facebookUrl === 'string' ? publishRes.facebookUrl.trim() : ''
      if (fbUrl) {
        // Facebook Pages UI can be delayed/filtered; give the user a reliable permalink.
        try {
          await navigator.clipboard.writeText(fbUrl)
          toast.info(`Facebook link copied: ${fbUrl}`, { durationMs: 9000 })
        } catch {
          toast.info(`View on Facebook: ${fbUrl}`, { durationMs: 9000 })
        }
      }
    }
    showPublishConfirm.value = false
    reset()
  } catch (err) {
    toast.error(err?.message || 'Failed to publish post.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.post-creator {
  margin-bottom: var(--spacing-lg);
}

.creator-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.creator-title {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.creator-hint {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.creator-hint-logged {
  max-width: 36rem;
  text-align: right;
  line-height: 1.45;
  color: var(--text-secondary);
}

.page-missing-banner {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid #f59e0b;
  background-color: #fffbeb;
}

.page-missing-title {
  margin: 0 0 var(--spacing-sm);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.page-missing-text {
  margin: 0 0 var(--spacing-md);
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.page-missing-text code {
  font-size: 0.85rem;
}

.page-missing-steps {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.page-missing-steps li {
  margin-bottom: var(--spacing-sm);
}

.page-missing-debug {
  margin: 0 0 var(--spacing-md);
  padding: var(--spacing-md);
  font-size: 0.8rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-sm);
  border: 1px solid #fcd34d;
}

.page-missing-debug-label {
  font-weight: 700;
  color: var(--text-secondary);
}

.page-missing-actions {
  margin-bottom: var(--spacing-md);
}

.page-target {
  margin-bottom: var(--spacing-lg);
}

.page-target-field {
  margin: 0;
}

.page-target-single {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.select {
  width: 100%;
  max-width: 28rem;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.95rem;
}

.creator-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.textarea {
  width: 100%;
  resize: vertical;
  padding: var(--spacing-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.5;
}

.textarea:disabled {
  opacity: 0.7;
}

.meta {
  align-self: flex-end;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.file {
  width: 100%;
}

.preview {
  margin-top: var(--spacing-sm);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  background-color: var(--bg-tertiary);
}

.preview img {
  width: 100%;
  height: auto;
  max-height: 360px;
  object-fit: cover;
  display: block;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  background-color: var(--accent);
  color: white;
}

.publish-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal, 1000) + 5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background-color: rgba(15, 23, 42, 0.45);
}

.publish-confirm-dialog {
  width: 100%;
  max-width: 26rem;
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-lg, 0 20px 50px rgba(0, 0, 0, 0.2));
  outline: none;
}

.publish-confirm-title {
  margin: 0 0 var(--spacing-sm);
  font-size: 1.15rem;
  color: var(--text-primary);
}

.publish-confirm-lead {
  margin: 0 0 var(--spacing-sm);
  font-size: 0.95rem;
  color: var(--text-primary);
}

.publish-confirm-text {
  margin: 0 0 var(--spacing-sm);
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.publish-confirm-toast-hint {
  margin: 0 0 var(--spacing-md);
  font-size: 0.85rem;
  color: var(--text-tertiary);
  line-height: 1.45;
}

.publish-confirm-page-link-wrap {
  margin: 0 0 var(--spacing-md);
}

.publish-confirm-page-link {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent);
  text-decoration: underline;
}

.publish-confirm-page-link:hover {
  text-decoration: none;
}

.publish-confirm-preview {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border);
}

.publish-confirm-preview-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  margin-bottom: var(--spacing-xs);
}

.publish-confirm-preview-body {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.publish-confirm-note {
  margin: 0 0 var(--spacing-md);
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.publish-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}
</style>
