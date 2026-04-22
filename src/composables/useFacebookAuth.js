/**
 * Facebook authentication + Page context
 */

import { ref, computed } from 'vue'
import { facebookService } from '../services/facebookService'
import { storageService } from '../services/storageService'

const user = ref(null)
const isAuthenticated = ref(false)
const isLoading = ref(false)
const error = ref(null)
const pageInfo = ref(null)

/** Redirect-based OAuth flow does not need JS SDK init. */
const facebookSdkPreparing = ref(false)

const storedUser = storageService.getUser()
if (storedUser?.accessToken) {
  user.value = storedUser
  isAuthenticated.value = true
  facebookService.hydrateFromUser(storedUser)
}

async function refreshFromServer() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) return { success: false }

    user.value = data.user
    isAuthenticated.value = true
    storageService.saveUser(data.user)
    facebookService.hydrateFromUser(data.user)
    return { success: true, user: data.user }
  } catch {
    return { success: false }
  }
}

// Best-effort session restore when page loads after FB redirect.
refreshFromServer()

export function useFacebookAuth() {
  const login = async () => {
    isLoading.value = true
    error.value = null
    pageInfo.value = null

    try {
      // Redirect user to Facebook login page (facebook.com) then back to this app.
      window.location.assign('/auth/facebook/login')
      return { success: true }
    } catch (err) {
      console.error('Login error:', err)
      error.value = 'An error occurred during login'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    isLoading.value = true
    error.value = null

    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
      facebookService.clearSession()
      user.value = null
      isAuthenticated.value = false
      pageInfo.value = null
      storageService.clearUser()
      return { success: true }
    } catch (err) {
      console.error('Logout error:', err)
      error.value = 'An error occurred during logout'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Switch active Page for posting / page info (updates persisted user).
   */
  const setSelectedPage = (pageId) => {
    try {
      if (!user.value) return false
      if (!facebookService.setSelectedPage(pageId)) return false

      const next = {
        ...user.value,
        selectedPageId: facebookService.selectedPageId,
        pageAccessToken: facebookService.pageAccessToken
      }
      user.value = next
      storageService.saveUser(next)
      pageInfo.value = null
      return true
    } catch (err) {
      console.error('setSelectedPage:', err)
      error.value = 'Failed to update Page'
      return false
    }
  }

  const refreshPageInfo = async () => {
    if (!isAuthenticated.value) {
      pageInfo.value = null
      return { success: false, error: 'Not signed in' }
    }
    const res = await facebookService.getPageInfo()
    if (res.success) {
      pageInfo.value = res.page
      return { success: true, page: res.page }
    }
    pageInfo.value = null
    return { success: false, error: res.error }
  }

  const updateUserProfile = (updates) => {
    try {
      if (user.value) {
        user.value = { ...user.value, ...updates }
        storageService.saveUser(user.value)
        facebookService.hydrateFromUser(user.value)
        return true
      }
      return false
    } catch (err) {
      console.error('Error updating profile:', err)
      error.value = 'Failed to update profile'
      return false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const isLoggedIn = computed(() => isAuthenticated.value)
  const currentUser = computed(() => user.value)
  const authError = computed(() => error.value)
  const authLoading = computed(() => isLoading.value)
  const managedPages = computed(() => user.value?.pages || [])
  const selectedPageId = computed(() => user.value?.selectedPageId || null)

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    pageInfo,
    facebookSdkPreparing,
    login,
    logout,
    setSelectedPage,
    refreshPageInfo,
    updateUserProfile,
    clearError,
    refreshFromServer,
    isLoggedIn,
    currentUser,
    authError,
    authLoading,
    managedPages,
    selectedPageId
  }
}
