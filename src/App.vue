<template>
  <div class="app-container">
    <ToastHost />
    <div v-if="showLogoutOverlay" class="fullscreen-loading" role="status" aria-live="polite">
      <div class="fullscreen-loading__panel" role="presentation">
        <div class="fullscreen-loading__spinnerWrap" aria-hidden="true">
          <span class="fullscreen-loading__spinner"></span>
        </div>
        <div class="fullscreen-loading__content">
          <div class="fullscreen-loading__title">Signing you out</div>
          <div class="fullscreen-loading__subtitle">Clearing your session securely…</div>
        </div>
      </div>
    </div>
    <NavBar
      :user="currentUser"
      :is-authenticated="isUserLoggedIn"
      :is-loading="authLoading"
      :sdk-preparing="facebookSdkPreparing"
      :theme="theme"
      @login="handleLogin"
      @logout="handleLogout"
      @toggle-theme="toggleTheme"
    />

    <main class="main-content">
      <div v-if="sharedPost" class="content-wrapper">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Shared post</h2>
          </div>
          <div class="card-body">
            <p style="white-space: pre-wrap; margin: 0">{{ sharedPost.content }}</p>
            <div v-if="sharedPost.image" style="margin-top: 12px">
              <img :src="sharedPost.image" alt="Shared post image" style="max-width: 100%; border-radius: 12px" />
            </div>
          </div>
        </div>
      </div>

      <div v-else class="logged-in-content">
        <div class="content-wrapper">
          <PostCreator
            :is-authenticated="isUserLoggedIn"
            :user="currentUser"
            @post-created="handlePostCreated"
          />
          <PostFeed
            :posts="visiblePosts"
            :is-authenticated="isUserLoggedIn"
            @post-deleted="handlePostDeleted"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ToastHost from './components/ToastHost.vue'
import NavBar from './components/NavBar.vue'
import PostCreator from './components/PostCreator.vue'
import PostFeed from './components/PostFeed.vue'
import { useFacebookAuth } from './composables/useFacebookAuth'
import { usePostStore } from './composables/usePostStore'
import { useToast } from './composables/useToast'
import { storageService } from './services/storageService'
import { useTheme } from './composables/useTheme'

const {
  isAuthenticated,
  user,
  login,
  logout,
  authLoading,
  facebookSdkPreparing,
  authError,
  clearError: clearLoginError,
  refreshFromServer
} = useFacebookAuth()
const { posts, addPost, upsertFacebookPosts, deletePost, loadPosts, clearPosts } = usePostStore()
const toast = useToast()
const { theme, toggleTheme } = useTheme()

const isUserLoggedIn = computed(() => isAuthenticated.value)
const currentUser = computed(() => user.value)
const allPosts = computed(() => posts.value)
// Hide saved posts while logged out; show again after logging in.
const visiblePosts = computed(() => (isUserLoggedIn.value ? allPosts.value : []))
const sharedPost = ref(null)
// FB feed sync is optional; local posts are always shown from storage.
const isSyncingFromFacebook = ref(false)
const syncBlockedByPermission = ref(false)
const isLoggingOut = ref(false)
const showLogoutOverlay = computed(() => isLoggingOut.value)

onMounted(() => {
  loadPosts()

  // Handle redirect-based OAuth success/error feedback
  const params = new URLSearchParams(window.location.search)
  const sharedPostId = params.get('shared_post')
  if (sharedPostId) {
    const p = storageService.getPostById(sharedPostId)
    if (p) sharedPost.value = p
  }
  const fbError = params.get('fb_error')
  const fbOk = params.get('fb')
  const fbRetry = params.get('fb_retry')
  if (fbError) toast.error(decodeURIComponent(fbError))
  if (fbRetry) {
    toast.info('Retrying Facebook login with minimal permissions…', { durationMs: 2000 })
    window.setTimeout(() => {
      window.location.assign(fbRetry)
    }, 250)
    return
  }
  if (fbOk) {
    refreshFromServer().then((r) => {
      if (r?.success) {
        toast.success('Signed in with Facebook.')
      }
    })
  }

  // Clear redirect params so refreshes don't re-show stale toasts
  if (fbError || fbOk || fbRetry) {
    params.delete('fb_error')
    params.delete('fb')
    params.delete('fb_retry')
    const qs = params.toString()
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`
    window.history.replaceState({}, '', nextUrl)
  }
})

const handleLogin = async () => {
  clearLoginError()
  const res = await login()
  if (res?.redirecting) return
  if (res?.success) toast.success('Signed in with Facebook.')
  else if (res?.error) toast.error(res.error)
}

const handleLogout = async () => {
  isLoggingOut.value = true
  const startedAt = performance.now()
  // Ensure the overlay renders before any async work (prevents "no loading UI" flashes).
  await nextTick()
  try {
    const res = await logout()
    if (!res?.success && res?.error) toast.error(res.error)
  } finally {
    // Keep the loading overlay visible long enough to be noticeable/consistent.
    const elapsedMs = performance.now() - startedAt
    const remainingMs = Math.max(0, 2000 - elapsedMs)
    if (remainingMs) await new Promise((r) => window.setTimeout(r, remainingMs))
    isLoggingOut.value = false
  }
}

const handlePostCreated = (newPost) => {
  const res = addPost(newPost)
  if (res?.success) {
    // PostCreator already toasts when the story is published to the Facebook Page.
    return
  }
  toast.error(res?.error || 'Failed to save post in this app.')
}

const handlePostDeleted = (postId) => {
  const res = deletePost(postId)
  if (res?.success) toast.success('Post deleted.')
  else toast.error(res?.error || 'Failed to delete post.')
}

const handleSyncFromFacebook = async ({ silentIfBusy = false, silentIfNoChanges = false } = {}) => {
  if (!isUserLoggedIn.value) {
    toast.error('Please sign in to sync from the LGU Page.')
    return
  }
  if (syncBlockedByPermission.value) {
    if (!silentIfBusy) {
      toast.error('Sync is blocked: enable pages_read_engagement in your Meta app, then log in again.')
    }
    return
  }
  if (isSyncingFromFacebook.value) {
    if (!silentIfBusy) toast.info('Sync already running…')
    return
  }
  isSyncingFromFacebook.value = true
  try {
    const res = await fetch('/api/lgu/feed?limit=25', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.success) {
      if (data?.code === 10 && data?.requiredPermission === 'pages_read_engagement') {
        syncBlockedByPermission.value = true
        toast.error(data?.error || 'Sync requires pages_read_engagement. Enable it in Meta app settings, then log in again.')
        return
      }
      toast.error(data?.error || `Failed to sync (${res.status}).`)
      return
    }
    const merged = upsertFacebookPosts(Array.isArray(data.posts) ? data.posts : [])
    if (!merged?.success) {
      toast.error(merged?.error || 'Failed to sync posts.')
      return
    }
    // Sync worked; clear any previous permission-block state.
    syncBlockedByPermission.value = false
    const added = merged.added || 0
    const updated = merged.updated || 0
    if (!(silentIfNoChanges && added === 0 && updated === 0)) {
      toast.success(`Synced from LGU Page. Added ${added}, updated ${updated}.`)
    }
  } catch (e) {
    toast.error(e?.message || 'Failed to sync posts.')
  } finally {
    isSyncingFromFacebook.value = false
  }
}

// Note: we intentionally do NOT auto-sync Facebook feed on load/login,
// because Graph feed reading may be blocked by Meta app feature gating (code 10).
</script>

<style>
@import './styles/global.css';
@import './styles/variables.css';
@import './styles/components.css';
@import './styles/layout.css';
</style>
