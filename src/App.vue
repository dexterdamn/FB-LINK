<template>
  <div class="app-container">
    <ToastHost />
    <NavBar
      :user="currentUser"
      :is-authenticated="isUserLoggedIn"
      :is-loading="authLoading"
      :sdk-preparing="facebookSdkPreparing"
      @login="handleLogin"
      @logout="handleLogout"
    />
    
    <main class="main-content">
      <div class="logged-in-content">
        <div class="content-wrapper">
          <PostCreator
            :is-authenticated="isUserLoggedIn"
            @post-created="handlePostCreated"
          />
          <PostFeed
            :posts="allPosts"
            :is-authenticated="isUserLoggedIn"
            @post-deleted="handlePostDeleted"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import ToastHost from './components/ToastHost.vue'
import NavBar from './components/NavBar.vue'
import PostCreator from './components/PostCreator.vue'
import PostFeed from './components/PostFeed.vue'
import { useFacebookAuth } from './composables/useFacebookAuth'
import { usePostStore } from './composables/usePostStore'
import { useToast } from './composables/useToast'

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
const { posts, addPost, deletePost, loadPosts, clearPosts } = usePostStore()
const toast = useToast()

const isUserLoggedIn = computed(() => isAuthenticated.value)
const currentUser = computed(() => user.value)
const allPosts = computed(() => posts.value)

watch(isAuthenticated, (next) => {
  if (!next) clearPosts()
})

onMounted(() => {
  loadPosts()

  // Handle redirect-based OAuth success/error feedback
  const params = new URLSearchParams(window.location.search)
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
  if (fbOk) refreshFromServer()

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
  if (res?.success) toast.success('Signed in with Facebook.')
  else if (res?.error) toast.error(res.error)
}

const handleLogout = async () => {
  const res = await logout()
  if (res?.success) {
    clearPosts()
    toast.success('Logged out.')
  }
  else if (res?.error) toast.error(res.error)
}

const handlePostCreated = (newPost) => {
  const res = addPost(newPost)
  if (res?.success) toast.success('Post saved to your feed.')
  else toast.error(res?.error || 'Failed to save post.')
}

const handlePostDeleted = (postId) => {
  if (!isUserLoggedIn.value) {
    toast.error('Please log in to delete posts.')
    return
  }
  const res = deletePost(postId)
  if (res?.success) toast.success('Post deleted.')
  else toast.error(res?.error || 'Failed to delete post.')
}
</script>

<style>
@import './styles/global.css';
@import './styles/variables.css';
@import './styles/components.css';
@import './styles/layout.css';
</style>
