<template>
  <div class="post-feed">
    <div class="feed-header">
      <h2>Posts in this app</h2>
      <div v-if="isAuthenticated" class="feed-filters">
        <button
          class="filter-btn"
          :class="{ active: sortBy === 'newest' }"
          @click="sortBy = 'newest'"
        >
          Latest
        </button>
        <button
          class="filter-btn"
          :class="{ active: sortBy === 'popular' }"
          @click="sortBy = 'popular'"
        >
          Popular
        </button>
      </div>
    </div>

    <div v-if="sortedPosts.length === 0" class="empty-feed">
      <div class="empty-icon">📝</div>
      <h3>No posts yet</h3>
      <p v-if="isAuthenticated">Start by creating your first post above!</p>
      <p v-else>Log in with Facebook (button in the header) to publish posts here.</p>
    </div>

    <div v-else class="posts-list">
      <PostCard
        v-for="post in sortedPosts"
        :key="post.id"
        :post="post"
        :is-authenticated="isAuthenticated"
        :userName="currentUser.name"
        :userAvatar="currentUser.picture"
        :show-delete-option="isAuthenticated"
        @post-deleted="handlePostDeleted"
      />
    </div>

    <div v-if="isLoadingMore" class="loading-more">
      <div class="spinner"></div>
      <span>Loading more posts...</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PostCard from './PostCard.vue'
import { useFacebookAuth } from '../composables/useFacebookAuth'

const props = defineProps({
  posts: {
    type: Array,
    default: () => []
  },
  isAuthenticated: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['post-deleted'])
const { user } = useFacebookAuth()

const sortBy = ref('newest')
const isLoadingMore = ref(false)

const currentUser = computed(() => user.value || {
  name: 'User',
  picture: 'https://via.placeholder.com/40'
})

const sortedPosts = computed(() => {
  if (!props.isAuthenticated) return []

  const posts = [...props.posts]

  if (sortBy.value === 'newest') {
    return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  } else if (sortBy.value === 'popular') {
    return posts.sort((a, b) => {
      const scoreA = (b.likes || 0) + (b.shares || 0) * 2
      const scoreB = (a.likes || 0) + (a.shares || 0) * 2
      return scoreB - scoreA
    })
  }
  
  return posts
})

const handlePostDeleted = (postId) => {
  emit('post-deleted', postId)
}
</script>

<style scoped>
.post-feed {
  width: 100%;
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border);
}

.feed-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.feed-filters {
  display: flex;
  gap: var(--spacing-sm);
}

.filter-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.filter-btn.active {
  background-color: var(--accent);
  color: white;
  border-color: var(--accent);
}

.empty-feed {
  text-align: center;
  padding: var(--spacing-2xl);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--border);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-lg);
}

.empty-feed h3 {
  margin: var(--spacing-md) 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.empty-feed p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.posts-list {
  display: flex;
  flex-direction: column;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  color: var(--text-secondary);
}

.loading-more .spinner {
  width: 20px;
  height: 20px;
}

@media (max-width: 768px) {
  .feed-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .feed-filters {
    width: 100%;
  }

  .filter-btn {
    flex: 1;
  }
}
</style>
