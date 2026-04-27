/**
 * Posts Store Composable
 * Handles post state management and operations
 */

import { ref, computed } from 'vue'
import { storageService } from '../services/storageService'

const posts = ref([])
const isLoading = ref(false)
const error = ref(null)

// Load posts from storage on initialization
const storedPosts = storageService.getPosts()
posts.value = storedPosts

export function usePostStore() {
  /**
   * Load posts from storage
   */
  const loadPosts = async () => {
    isLoading.value = true
    error.value = null

    try {
      const savedPosts = storageService.getPosts()
      posts.value = savedPosts
      return savedPosts
    } catch (err) {
      console.error('Error loading posts:', err)
      error.value = 'Failed to load posts'
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Add a new post
   */
  const addPost = (post) => {
    try {
      const newPost = {
        id: post.id || `post_${Date.now()}`,
        content: post.content,
        image: post.image || null,
        media: Array.isArray(post.media) ? post.media : (post.media ? [post.media] : null),
        createdAt: post.createdAt || new Date().toISOString(),
        likes: post.likes || 0,
        shares: post.shares || 0,
        comments: post.comments || [],
        facebookUrl: post.facebookUrl || null
      }

      posts.value.unshift(newPost)
      storageService.addPost(newPost)

      return {
        success: true,
        post: newPost
      }
    } catch (err) {
      console.error('Error adding post:', err)
      error.value = 'Failed to add post'
      return {
        success: false,
        error: error.value
      }
    }
  }

  /**
   * Merge posts fetched from Facebook into local storage (no duplicates).
   * Facebook feed items don't include images here; we keep any existing local image for same id.
   */
  const upsertFacebookPosts = (facebookPosts = []) => {
    try {
      const incoming = Array.isArray(facebookPosts) ? facebookPosts : []
      if (!incoming.length) {
        return { success: true, added: 0, updated: 0 }
      }

      const existing = Array.isArray(posts.value) ? posts.value : []
      const byId = new Map(existing.map((p) => [String(p.id), p]))

      let added = 0
      let updated = 0

      for (const raw of incoming) {
        const id = raw?.id != null ? String(raw.id) : ''
        if (!id) continue

        const next = {
          id,
          content: String(raw?.content || ''),
          image: null,
          createdAt: raw?.createdAt || new Date().toISOString(),
          likes: 0,
          shares: 0,
          comments: [],
          facebookUrl: raw?.facebookUrl || null
        }

        const prev = byId.get(id)
        if (!prev) {
          byId.set(id, next)
          added += 1
          continue
        }

        // Preserve local-only fields if already present (image/likes/shares/comments).
        const prevCreatedAt = prev.createdAt || null
        const nextCreatedAt = next.createdAt || null
        const createdAt =
          prevCreatedAt && nextCreatedAt
            ? new Date(prevCreatedAt) > new Date(nextCreatedAt)
              ? prevCreatedAt
              : nextCreatedAt
            : (prevCreatedAt || nextCreatedAt || new Date().toISOString())
        byId.set(id, {
          ...next,
          image: prev.image || null,
          likes: prev.likes || 0,
          shares: prev.shares || 0,
          comments: Array.isArray(prev.comments) ? prev.comments : [],
          createdAt
        })
        updated += 1
      }

      const merged = Array.from(byId.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      posts.value = merged
      storageService.savePosts(merged)

      return { success: true, added, updated }
    } catch (err) {
      console.error('Error merging Facebook posts:', err)
      error.value = 'Failed to sync posts'
      return { success: false, error: error.value }
    }
  }

  /**
   * Update a post
   */
  const updatePost = (postId, updates) => {
    try {
      const index = posts.value.findIndex(p => p.id === postId)

      if (index !== -1) {
        posts.value[index] = { ...posts.value[index], ...updates }
        storageService.updatePost(postId, updates)

        return {
          success: true,
          post: posts.value[index]
        }
      } else {
        error.value = 'Post not found'
        return {
          success: false,
          error: error.value
        }
      }
    } catch (err) {
      console.error('Error updating post:', err)
      error.value = 'Failed to update post'
      return {
        success: false,
        error: error.value
      }
    }
  }

  /**
   * Delete a post
   */
  const deletePost = (postId) => {
    try {
      const index = posts.value.findIndex(p => p.id === postId)

      if (index !== -1) {
        const deletedPost = posts.value[index]
        posts.value.splice(index, 1)
        storageService.deletePost(postId)

        return {
          success: true,
          post: deletedPost
        }
      } else {
        error.value = 'Post not found'
        return {
          success: false,
          error: error.value
        }
      }
    } catch (err) {
      console.error('Error deleting post:', err)
      error.value = 'Failed to delete post'
      return {
        success: false,
        error: error.value
      }
    }
  }

  /**
   * Get a post by ID
   */
  const getPostById = (postId) => {
    try {
      return posts.value.find(p => p.id === postId) || null
    } catch (err) {
      console.error('Error getting post:', err)
      return null
    }
  }

  /**
   * Add like to a post
   */
  const likePost = (postId) => {
    try {
      const post = getPostById(postId)
      if (post) {
        const newLikes = (post.likes || 0) + 1
        return updatePost(postId, { likes: newLikes })
      }
      return { success: false, error: 'Post not found' }
    } catch (err) {
      console.error('Error liking post:', err)
      return { success: false, error: 'Failed to like post' }
    }
  }

  /**
   * Add share to a post
   */
  const sharePost = (postId) => {
    try {
      const post = getPostById(postId)
      if (post) {
        const newShares = (post.shares || 0) + 1
        return updatePost(postId, { shares: newShares })
      }
      return { success: false, error: 'Post not found' }
    } catch (err) {
      console.error('Error sharing post:', err)
      return { success: false, error: 'Failed to share post' }
    }
  }

  /**
   * Add comment to a post
   */
  const addComment = (postId, comment) => {
    try {
      const post = getPostById(postId)
      if (post) {
        const comments = post.comments || []
        comments.push({
          id: `comment_${Date.now()}`,
          text: comment,
          createdAt: new Date().toISOString()
        })
        return updatePost(postId, { comments })
      }
      return { success: false, error: 'Post not found' }
    } catch (err) {
      console.error('Error adding comment:', err)
      return { success: false, error: 'Failed to add comment' }
    }
  }

  /**
   * Clear all posts
   */
  const clearPosts = () => {
    try {
      posts.value = []
      storageService.clearPosts()
      return true
    } catch (err) {
      console.error('Error clearing posts:', err)
      error.value = 'Failed to clear posts'
      return false
    }
  }

  /**
   * Search posts
   */
  const searchPosts = (query) => {
    try {
      const lowerQuery = query.toLowerCase()
      return posts.value.filter(post =>
        post.content.toLowerCase().includes(lowerQuery)
      )
    } catch (err) {
      console.error('Error searching posts:', err)
      return []
    }
  }

  /**
   * Get posts count
   */
  const postsCount = computed(() => posts.value.length)

  /**
   * Get most liked post
   */
  const mostLikedPost = computed(() => {
    if (posts.value.length === 0) return null
    return [...posts.value].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0]
  })

  /**
   * Get posts statistics
   */
  const postsStats = computed(() => {
    const total = posts.value.length
    const totalLikes = posts.value.reduce((sum, p) => sum + (p.likes || 0), 0)
    const totalShares = posts.value.reduce((sum, p) => sum + (p.shares || 0), 0)

    return {
      total,
      totalLikes,
      totalShares,
      averageLikes: total > 0 ? (totalLikes / total).toFixed(1) : 0
    }
  })

  /**
   * Clear error
   */
  const clearError = () => {
    error.value = null
  }

  return {
    posts,
    isLoading,
    error,
    loadPosts,
    addPost,
    upsertFacebookPosts,
    updatePost,
    deletePost,
    getPostById,
    likePost,
    sharePost,
    addComment,
    clearPosts,
    searchPosts,
    clearError,
    postsCount,
    mostLikedPost,
    postsStats
  }
}
