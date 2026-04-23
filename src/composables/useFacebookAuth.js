/**
 * Facebook OAuth (server session cookie).
 * Login redirects to `/auth/facebook/login`; session is read via `/api/me`.
 */

import { ref, computed } from 'vue'
import { facebookService } from '../services/facebookService'

const user = ref(null)
const isAuthenticated = ref(false)
const isLoading = ref(false)
const error = ref(null)

// Kept for prop compatibility in `NavBar.vue` (redirect flow does not use the JS SDK here)
const facebookSdkPreparing = ref(false)

async function refreshFromServer() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success || !data?.user?.id) {
      user.value = null
      isAuthenticated.value = false
      facebookService.clearSession()
      return { success: false }
    }
    user.value = data.user
    isAuthenticated.value = true
    facebookService.hydrateFromUser(data.user)
    return { success: true, user: data.user }
  } catch {
    user.value = null
    isAuthenticated.value = false
    facebookService.clearSession()
    return { success: false }
  }
}

refreshFromServer()

export function useFacebookAuth() {
  const login = async () => {
    // If a session already exists, don't redirect to Facebook again.
    // This avoids bouncing the user back to "Continue to Facebook" when already logged in.
    if (isAuthenticated.value && user.value?.id) {
      return { success: true, alreadyLoggedIn: true }
    }
    const refreshed = await refreshFromServer()
    if (refreshed?.success) {
      return { success: true, alreadyLoggedIn: true }
    }

    // Do not set isLoading: if /auth/facebook/login falls through to the SPA (no proxy /
    // API down), the page may not unload and the button would stay disabled with no UI.
    error.value = null
    try {
      window.location.assign('/auth/facebook/login')
      return { success: true, redirecting: true }
    } catch (err) {
      console.error('Login error:', err)
      error.value = 'Could not start Facebook login'
      return { success: false, error: error.value }
    }
  }

  const logout = async () => {
    isLoading.value = true
    error.value = null
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
      user.value = null
      isAuthenticated.value = false
      facebookService.clearSession()
      return { success: true }
    } catch (err) {
      console.error('Logout error:', err)
      error.value = 'An error occurred during logout'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const isLoggedIn = computed(() => isAuthenticated.value)
  const currentUser = computed(() => user.value)
  const authError = computed(() => error.value)
  const authLoading = computed(() => isLoading.value)

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    facebookSdkPreparing,
    login,
    logout,
    clearError,
    refreshFromServer,
    isLoggedIn,
    currentUser,
    authError,
    authLoading
  }
}
