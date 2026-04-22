<template>
  <div class="post-creator card" :class="{ 'post-creator--locked': !isAuthenticated }">
    <div class="card-header">
      <h2 class="card-title">Create a post</h2>
    </div>

    <div class="card-body">
      <div v-if="!isAuthenticated" class="login-notice message message-info">
        <span>Use “Continue with Facebook” in the header to sign in (same style as Google). You can create a Facebook account from that window if you need one.</span>
      </div>

      <div v-else-if="!managedPages.length" class="message message-info">
        <span>
          You’re signed in, but no managed Facebook Pages were returned. This app can publish automatically only to Pages.
          For personal profile posting, Facebook requires a user-controlled Share dialog (link sharing).
        </span>
      </div>

      <div v-if="isAuthenticated && managedPages.length" class="form-group">
        <label for="page-select" class="form-label">Post as Page</label>
        <select
          id="page-select"
          class="form-input"
          :value="selectedPageId || ''"
          @change="onPageChange($event.target.value)"
        >
          <option v-for="p in managedPages" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <div class="page-info-actions">
          <button type="button" class="btn btn-secondary btn-small" :disabled="pageInfoLoading" @click="loadPageInfo">
            {{ pageInfoLoading ? 'Loading…' : 'Load page info' }}
          </button>
        </div>
        <div v-if="pageInfo" class="page-info-panel text-sm">
          <div><strong>{{ pageInfo.name }}</strong> · {{ pageInfo.fan_count ?? '—' }} followers</div>
          <div v-if="pageInfo.about" class="text-muted page-info-about">{{ pageInfo.about }}</div>
        </div>
        <div v-if="pageInfoError" class="message message-error page-info-error">
          <span>{{ pageInfoError }}</span>
        </div>
      </div>

      <div v-if="successMessage" class="message message-success">
        <span>{{ successMessage }}</span>
      </div>

      <div v-if="errorMessage" class="message message-error">
        <span>{{ errorMessage }}</span>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="post-content" class="form-label">Message</label>
          <textarea
            id="post-content"
            v-model="formData.content"
            class="form-input form-textarea"
            placeholder="Write your post… (optional if you use a link or image)"
            maxlength="2000"
            :disabled="!canCompose"
            @input="updateCharCount"
          ></textarea>
          <div class="char-count" :class="{ 'char-warning': formData.content.length > 1800 }">
            {{ formData.content.length }} / 2000
          </div>
        </div>

        <div class="form-group">
          <label for="post-link" class="form-label">Link (optional)</label>
          <input
            id="post-link"
            v-model="formData.link"
            type="url"
            class="form-input"
            placeholder="https://…"
            :disabled="!canCompose"
          />
        </div>

        <div class="form-group">
          <label for="post-picture" class="form-label">Picture URL (optional, for link posts)</label>
          <input
            id="post-picture"
            v-model="formData.picture"
            type="url"
            class="form-input"
            placeholder="https://… (public image URL)"
            :disabled="!canCompose"
          />
        </div>

        <div class="form-group form-row">
          <label class="checkbox-label">
            <input v-model="formData.published" type="checkbox" :disabled="!canCompose || !canPublishToPage" />
            <span>Published (uncheck for draft / scheduled workflows elsewhere)</span>
          </label>
        </div>

        <div class="form-group">
          <label for="post-image" class="form-label">Image file (optional)</label>

          <div v-if="imagePreview" class="image-preview">
            <img :src="imagePreview" alt="Post preview" />
            <button
              type="button"
              class="image-remove-btn"
              :disabled="!canCompose"
              @click="removeImage"
              title="Remove image"
            >
              ✕
            </button>
          </div>

          <div v-if="!imagePreview" class="file-input-wrapper">
            <input
              id="post-image"
              type="file"
              accept="image/*"
              :disabled="!canCompose"
              @change="handleImageUpload"
            />
            <label for="post-image" class="btn btn-secondary" :class="{ 'is-disabled': !canCompose }">
              Choose image
            </label>
          </div>

          <div class="image-info text-sm text-muted">
            If you have a managed Page selected, file uploads use the Page <code>photos</code> edge (multipart). Text and links use the Page <code>feed</code> edge.
          </div>
        </div>

        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary btn-large"
            :disabled="isLoading || !canCompose || !canSubmitContent || (!canPublishToPage && !canShareToProfile)"
          >
            <span v-if="isLoading" class="spinner"></span>
            {{
              isLoading
                ? 'Publishing…'
                : canPublishToPage
                  ? 'Publish to Facebook Page'
                  : 'Share on your Facebook profile'
            }}
          </button>
        </div>

        <div v-if="isLoading" class="publishing-status">
          <div class="spinner"></div>
          <span>Publishing…</span>
        </div>
      </form>
    </div>

    <div class="card-footer">
      <small class="text-muted">
        Page publishing uses Facebook Graph API (<code>POST /{page-id}/feed</code> / <code>POST /{page-id}/photos</code> with a Page access token).
        Personal profile posting can’t be automated by Graph for most apps; this app uses a Share dialog (link sharing) instead.
      </small>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { facebookService } from '../services/facebookService'
import { useFacebookAuth } from '../composables/useFacebookAuth'
import { useToast } from '../composables/useToast'

const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['post-created'])

const {
  managedPages,
  selectedPageId,
  setSelectedPage,
  pageInfo: authPageInfo,
  refreshPageInfo
} = useFacebookAuth()

const formData = ref({
  content: '',
  link: '',
  picture: '',
  published: true,
  image: null
})

const imagePreview = ref('')
const isLoading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const pageInfoLoading = ref(false)
const pageInfoError = ref('')

const pageInfo = computed(() => authPageInfo.value)
const toast = useToast()

const canCompose = computed(() => props.isAuthenticated)
const canPublishToPage = computed(() => props.isAuthenticated && managedPages.value.length > 0)
const canShareToProfile = computed(() => {
  // Facebook Share Dialog requires a URL; we can fall back to sharing the app URL.
  const hasAnyShareUrl = !!formData.value.link.trim() || (typeof window !== 'undefined' && !!window.location?.origin)
  return props.isAuthenticated && hasAnyShareUrl
})

const canSubmitContent = computed(() => {
  const t = formData.value.content.trim()
  const hasLink = !!formData.value.link.trim()
  const hasPicUrl = !!formData.value.picture.trim()
  const hasFile = formData.value.image instanceof File
  return !!(t || hasLink || hasPicUrl || hasFile)
})

watch(
  () => selectedPageId.value,
  () => {
    pageInfoError.value = ''
  }
)

const updateCharCount = () => {}

const onPageChange = (pageId) => {
  if (!pageId) return
  setSelectedPage(pageId)
}

const loadPageInfo = async () => {
  pageInfoError.value = ''
  pageInfoLoading.value = true
  try {
    const res = await refreshPageInfo()
    if (!res.success) {
      pageInfoError.value = res.error || 'Could not load page info.'
      toast.error(pageInfoError.value)
    } else {
      toast.success('Page info loaded.')
    }
  } finally {
    pageInfoLoading.value = false
  }
}

const handleImageUpload = (event) => {
  if (!canCompose.value) return

  const file = event.target.files?.[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'Image must be smaller than 5MB'
    toast.error(errorMessage.value)
    return
  }

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Please upload a valid image file'
    toast.error(errorMessage.value)
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target?.result || ''
    formData.value.image = file
    errorMessage.value = ''
    toast.success('Image added.')
  }
  reader.readAsDataURL(file)
}

const removeImage = () => {
  imagePreview.value = ''
  formData.value.image = null
  const fileInput = document.getElementById('post-image')
  if (fileInput) fileInput.value = ''
}

const handleSubmit = async () => {
  if (!canSubmitContent.value) {
    errorMessage.value = 'Add a message, link, picture URL, or image file.'
    toast.error(errorMessage.value)
    return
  }

  // If the user can't publish to a managed Page, we fall back to the Share Dialog (profile).
  if (!canPublishToPage.value) {
    if (!canShareToProfile.value) {
      errorMessage.value = 'To share on your profile, add a Link (URL) or stay on this site URL, then try again.'
      toast.error(errorMessage.value)
      return
    }

    // Share Dialog is user-controlled: this is the closest “auto post to profile” available.
    handleShare()

    successMessage.value = 'Facebook share dialog opened. Complete the share to post on your profile.'
    toast.info(successMessage.value)

    emit('post-created', {
      id: `local_${Date.now()}`,
      content: formData.value.content.trim(),
      image: imagePreview.value || null,
      createdAt: new Date().toISOString(),
      likes: 0,
      shares: 0,
      facebookUrl: null
    })

    formData.value.content = ''
    formData.value.link = ''
    formData.value.picture = ''
    formData.value.published = true
    removeImage()

    return
  }

  isLoading.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    const postData = {
      message: formData.value.content.trim(),
      image: formData.value.image || undefined,
      link: formData.value.link.trim() || undefined,
      picture: formData.value.picture.trim() || undefined,
      published: formData.value.published,
      createdAt: new Date().toISOString()
    }

    const result = await facebookService.publishPost(postData)

    if (result.success) {
      successMessage.value = 'Post published to your Page.'
      toast.success(successMessage.value)
      emit('post-created', {
        id: result.postId,
        content: formData.value.content.trim(),
        image: imagePreview.value || null,
        createdAt: postData.createdAt,
        likes: 0,
        shares: 0,
        facebookUrl: result.facebookUrl || null
      })

      formData.value.content = ''
      formData.value.link = ''
      formData.value.picture = ''
      formData.value.published = true
      removeImage()

      setTimeout(() => {
        successMessage.value = ''
      }, 4000)
    } else {
      errorMessage.value = result.error || 'Failed to publish post.'
      toast.error(errorMessage.value)
    }
  } catch (error) {
    console.error('Error publishing post:', error)
    errorMessage.value = 'An error occurred while publishing. Please try again.'
    toast.error(errorMessage.value)
  } finally {
    isLoading.value = false
  }
}

const handleShare = () => {
  if (!canCompose.value) {
    toast.error('Please sign in first.')
    return
  }
  const link = formData.value.link.trim() || (typeof window !== 'undefined' ? window.location.origin : '')
  if (!link) return toast.error('Missing a URL to share.')
  const quote = formData.value.content.trim() || undefined
  const res = facebookService.openShareDialog({ href: link, quote })
  if (!res.success) {
    toast.error(res.error || 'Failed to open Facebook share dialog.')
    return
  }
  toast.success('Facebook share dialog opened.')
}
</script>

<style scoped>
.post-creator {
  height: fit-content;
  position: sticky;
  top: 100px;
}

.post-creator--locked :deep(textarea:disabled) {
  opacity: 0.65;
  cursor: not-allowed;
}

.file-input-wrapper label.is-disabled {
  opacity: 0.65;
  cursor: not-allowed;
  pointer-events: none;
}

.char-count {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: var(--spacing-xs);
  text-align: right;
}

.char-warning {
  color: var(--error);
  font-weight: 500;
}

.image-info {
  margin-top: var(--spacing-sm);
  color: var(--text-secondary);
}

.file-input-wrapper {
  display: block;
  margin-bottom: var(--spacing-md);
}

.file-input-wrapper label {
  width: 100%;
  padding: var(--spacing-lg);
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-input-wrapper label:hover {
  border-color: var(--accent);
  background-color: var(--bg-secondary);
}

.form-actions {
  margin-top: var(--spacing-lg);
}

.publishing-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.publishing-status .spinner {
  width: 16px;
  height: 16px;
}

.page-info-actions {
  margin-top: var(--spacing-sm);
}

.page-info-panel {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.page-info-about {
  margin-top: var(--spacing-xs);
}

.page-info-error {
  margin-top: var(--spacing-sm);
}

.form-row {
  display: flex;
  align-items: flex-start;
}

.checkbox-label {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
  font-size: 0.9rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.checkbox-label input {
  margin-top: 0.2rem;
}

@media (max-width: 1024px) {
  .post-creator {
    position: static;
  }
}
</style>
