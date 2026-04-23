<template>
  <div class="post-card card hover-shadow">
    <div class="post-header">
      <div class="post-user-info">
        <img :src="userAvatar" :alt="userName" class="avatar" />
        <div class="user-details">
          <h4 class="user-name">{{ userName }}</h4>
          <span class="post-time">{{ formatTime(post.createdAt) }}</span>
        </div>
      </div>
      <button
        class="btn btn-small"
        @click="openMenu"
        v-if="canDelete"
      >
        ⋮
      </button>
      <div v-if="menuOpen" class="post-menu">
        <button
          class="menu-item menu-delete"
          @click="handleDelete"
        >
          Delete Post
        </button>
      </div>
    </div>

    <div class="post-content">
      <p>{{ post.content }}</p>
    </div>

    <div v-if="post.image" class="post-image">
      <img :src="post.image" :alt="post.content" />
    </div>

    <div class="post-stats">
      <span class="stat">
        <span class="stat-icon">👍</span>
        {{ post.likes }} likes
      </span>
      <span class="stat">
        <span class="stat-icon">🔄</span>
        {{ post.shares }} shares
      </span>
    </div>

    <div class="divider"></div>

    <div class="post-actions">
      <button
        class="action-btn"
        :class="{ 'liked': isLiked }"
        @click="handleLike"
      >
        <span class="action-icon">👍</span>
        Like
      </button>
      <button class="action-btn" @click="openShareMenu">
        <span class="action-icon">🔄</span>
        Share
      </button>
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

    <div v-if="shareMenuOpen" class="share-menu">
      <button
        class="menu-item"
        @click="copyShareLink"
      >
        📋 Copy Link
      </button>
      <a
        :href="whatsappShareLink"
        target="_blank"
        rel="noopener noreferrer"
        class="menu-item"
      >
        💬 Share on WhatsApp
      </a>
      <a
        :href="twitterShareLink"
        target="_blank"
        rel="noopener noreferrer"
        class="menu-item"
      >
        𝕏 Share on Twitter
      </a>
    </div>

    <div v-if="copySuccess" class="copy-feedback">
      Link copied! 📋
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePostStore } from '../composables/usePostStore'
import { facebookService } from '../services/facebookService'
import { useToast } from '../composables/useToast'

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
const shareMenuOpen = ref(false)
const isLiked = ref(false)
const copySuccess = ref(false)

const canDelete = computed(() => props.isAuthenticated && props.showDeleteOption)

/** Permalink to the post on the Facebook Page (Graph returns pageId_postId). No personal-timeline sharer. */
const facebookPagePostUrl = computed(() => {
  const u = props.post?.facebookUrl
  return typeof u === 'string' && u.trim() ? u.trim() : ''
})

const whatsappShareLink = computed(() => {
  const text = encodeURIComponent(`Check this out: ${props.post.content.substring(0, 100)}...`)
  return `https://wa.me/?text=${text}`
})

const twitterShareLink = computed(() => {
  const text = encodeURIComponent(`Check this out: ${props.post.content.substring(0, 100)}...`)
  return `https://twitter.com/intent/tweet?text=${text}`
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

const openMenu = () => {
  menuOpen.value = !menuOpen.value
  shareMenuOpen.value = false
}

const openShareMenu = () => {
  shareMenuOpen.value = !shareMenuOpen.value
  menuOpen.value = false
}

const handleDelete = async () => {
  if (!canDelete.value) {
    toast.error('Please log in to delete posts.')
    menuOpen.value = false
    return
  }
  if (!confirm('Are you sure you want to delete this post?')) return

  menuOpen.value = false

  const id = props.post.id
  const looksLikeGraphPost = typeof id === 'string' && id.includes('_')

  if (looksLikeGraphPost) {
    const res = await facebookService.deletePost(id)
    if (!res.success) {
      toast.error(res.error || 'Failed to delete post on Facebook.')
      return
    }
  }

  emit('post-deleted', id)
}

const handleLike = () => {
  isLiked.value = !isLiked.value
  const newLikes = isLiked.value ? props.post.likes + 1 : props.post.likes - 1
  updatePost(props.post.id, { likes: newLikes })
}

const copyShareLink = () => {
  const link = `${window.location.origin}?post=${props.post.id}`
  navigator.clipboard.writeText(link)
  copySuccess.value = true
  shareMenuOpen.value = false
  toast.success('Link copied.')

  setTimeout(() => {
    copySuccess.value = false
  }, 2000)
}
</script>

<style scoped>
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

.share-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background-color: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: var(--z-dropdown);
  min-width: 200px;
  overflow: hidden;
  margin-top: var(--spacing-md);
}

.share-menu .menu-item,
.share-menu a {
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
  text-decoration: none;
}

.share-menu .menu-item:hover,
.share-menu a:hover {
  background-color: var(--bg-secondary);
}

.copy-feedback {
  position: fixed;
  bottom: var(--spacing-lg);
  right: var(--spacing-lg);
  background-color: var(--success);
  color: white;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-modal);
  animation: slideInUp 0.3s ease;
}

@keyframes slideInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (max-width: 480px) {
  .post-actions {
    grid-template-columns: 1fr;
  }
}
</style>
