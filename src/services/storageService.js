/**
 * Storage Service
 * Handles local storage operations for posts and user data
 */

class StorageService {
  constructor() {
    this.POSTS_KEY = 'social_echo_posts'
    this.USER_KEY = 'social_echo_user'
    this.SETTINGS_KEY = 'social_echo_settings'
  }

  /**
   * Save posts to local storage
   * @param {Array} posts - Array of post objects
   */
  savePosts(posts) {
    try {
      localStorage.setItem(this.POSTS_KEY, JSON.stringify(posts))
      return true
    } catch (error) {
      console.error('Error saving posts:', error)
      return false
    }
  }

  /**
   * Get posts from local storage
   * @returns {Array} Array of post objects
   */
  getPosts() {
    try {
      const posts = localStorage.getItem(this.POSTS_KEY)
      return posts ? JSON.parse(posts) : []
    } catch (error) {
      console.error('Error reading posts:', error)
      return []
    }
  }

  /**
   * Add a single post to local storage
   * @param {Object} post - Post object to add
   */
  addPost(post) {
    try {
      const posts = this.getPosts()
      posts.unshift(post)
      this.savePosts(posts)
      return true
    } catch (error) {
      console.error('Error adding post:', error)
      return false
    }
  }

  /**
   * Update a post in local storage
   * @param {string} postId - ID of post to update
   * @param {Object} updates - Object with fields to update
   */
  updatePost(postId, updates) {
    try {
      const posts = this.getPosts()
      const index = posts.findIndex(p => p.id === postId)
      
      if (index !== -1) {
        posts[index] = { ...posts[index], ...updates }
        this.savePosts(posts)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error updating post:', error)
      return false
    }
  }

  /**
   * Delete a post from local storage
   * @param {string} postId - ID of post to delete
   */
  deletePost(postId) {
    try {
      const posts = this.getPosts()
      const filtered = posts.filter(p => p.id !== postId)
      this.savePosts(filtered)
      return true
    } catch (error) {
      console.error('Error deleting post:', error)
      return false
    }
  }

  /**
   * Get a single post by ID
   * @param {string} postId - ID of post to retrieve
   * @returns {Object|null} Post object or null if not found
   */
  getPostById(postId) {
    try {
      const posts = this.getPosts()
      return posts.find(p => p.id === postId) || null
    } catch (error) {
      console.error('Error getting post:', error)
      return null
    }
  }

  /**
   * Clear all posts from local storage
   */
  clearPosts() {
    try {
      localStorage.removeItem(this.POSTS_KEY)
      return true
    } catch (error) {
      console.error('Error clearing posts:', error)
      return false
    }
  }

  /**
   * Save user data to local storage
   * @param {Object} user - User object
   */
  saveUser(user) {
    try {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user))
      return true
    } catch (error) {
      console.error('Error saving user:', error)
      return false
    }
  }

  /**
   * Get user data from local storage
   * @returns {Object|null} User object or null
   */
  getUser() {
    try {
      const user = localStorage.getItem(this.USER_KEY)
      return user ? JSON.parse(user) : null
    } catch (error) {
      console.error('Error reading user:', error)
      return null
    }
  }

  /**
   * Clear user data from local storage
   */
  clearUser() {
    try {
      localStorage.removeItem(this.USER_KEY)
      return true
    } catch (error) {
      console.error('Error clearing user:', error)
      return false
    }
  }

  /**
   * Save app settings to local storage
   * @param {Object} settings - Settings object
   */
  saveSettings(settings) {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings))
      return true
    } catch (error) {
      console.error('Error saving settings:', error)
      return false
    }
  }

  /**
   * Get app settings from local storage
   * @returns {Object} Settings object
   */
  getSettings() {
    try {
      const settings = localStorage.getItem(this.SETTINGS_KEY)
      return settings ? JSON.parse(settings) : {}
    } catch (error) {
      console.error('Error reading settings:', error)
      return {}
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats including total items and size
   */
  getStorageStats() {
    try {
      const posts = this.getPosts()
      const user = this.getUser()
      const settings = this.getSettings()

      let totalSize = 0
      totalSize += JSON.stringify(posts).length
      totalSize += JSON.stringify(user).length
      totalSize += JSON.stringify(settings).length

      return {
        postsCount: posts.length,
        hasUser: !!user,
        totalSizeKB: (totalSize / 1024).toFixed(2)
      }
    } catch (error) {
      console.error('Error getting storage stats:', error)
      return { postsCount: 0, hasUser: false, totalSizeKB: 0 }
    }
  }

  /**
   * Clear all app data
   */
  clearAllData() {
    try {
      this.clearPosts()
      this.clearUser()
      localStorage.removeItem(this.SETTINGS_KEY)
      return true
    } catch (error) {
      console.error('Error clearing all data:', error)
      return false
    }
  }

  /**
   * Export data as JSON
   * @returns {Object} All app data
   */
  exportData() {
    try {
      return {
        posts: this.getPosts(),
        user: this.getUser(),
        settings: this.getSettings(),
        exportedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      return null
    }
  }

  /**
   * Import data from JSON
   * @param {Object} data - Data object to import
   */
  importData(data) {
    try {
      if (data.posts) this.savePosts(data.posts)
      if (data.user) this.saveUser(data.user)
      if (data.settings) this.saveSettings(data.settings)
      return true
    } catch (error) {
      console.error('Error importing data:', error)
      return false
    }
  }
}

export const storageService = new StorageService()
