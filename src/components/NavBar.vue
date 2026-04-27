<template>
  <nav class="navbar">
    <div class="navbar-wrapper">
      <div class="navbar-logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="url(#gradient)"/>
          <path d="M8 16L14 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32">
              <stop offset="0%" stop-color="#667eea"/>
              <stop offset="100%" stop-color="#764ba2"/>
            </linearGradient>
          </defs>
        </svg>
        <span>WEB APP</span>
      </div>

      <div class="navbar-spacer"></div>

      <div v-if="!isAuthenticated" class="navbar-auth">
        <FacebookLoginButton
          :is-loading="isLoading"
          :sdk-preparing="sdkPreparing"
          @click="handleLoginClick"
        />
        <p class="navbar-auth-hint">
          Sign in with Facebook to manage pages and publish (session cookie).
        </p>
      </div>

      <div v-else class="navbar-user">
        <div v-if="user" class="navbar-user-info">
          <div class="navbar-user-name">{{ user.name }}</div>
        </div>
        <div v-else class="navbar-user-placeholder">Loading session…</div>
        <img
          v-if="user?.picture"
          :src="user.picture"
          :alt="user?.name || 'Account'"
          class="avatar"
        />
        <div v-else class="avatar avatar-placeholder" aria-hidden="true" />
        <button
          type="button"
          class="btn btn-secondary btn-small theme-toggle-icon"
          :disabled="isLoading"
          @click="emit('toggle-theme')"
          :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M12 3.25a.9.9 0 0 1 .9.9v1.2a.9.9 0 1 1-1.8 0v-1.2a.9.9 0 0 1 .9-.9ZM12 18.65a.9.9 0 0 1 .9.9v1.2a.9.9 0 1 1-1.8 0v-1.2a.9.9 0 0 1 .9-.9ZM4.15 11.1h1.2a.9.9 0 1 1 0 1.8h-1.2a.9.9 0 1 1 0-1.8ZM18.65 11.1h1.2a.9.9 0 1 1 0 1.8h-1.2a.9.9 0 1 1 0-1.8ZM6.02 6.02a.9.9 0 0 1 1.27 0l.85.85a.9.9 0 1 1-1.27 1.27l-.85-.85a.9.9 0 0 1 0-1.27ZM16.86 16.86a.9.9 0 0 1 1.27 0l.85.85a.9.9 0 1 1-1.27 1.27l-.85-.85a.9.9 0 0 1 0-1.27ZM17.98 6.02a.9.9 0 0 1 0 1.27l-.85.85a.9.9 0 0 1-1.27-1.27l.85-.85a.9.9 0 0 1 1.27 0ZM7.14 16.86a.9.9 0 0 1 0 1.27l-.85.85a.9.9 0 1 1-1.27-1.27l.85-.85a.9.9 0 0 1 1.27 0Z"
              fill="currentColor"
              opacity="0.92"
            />
            <path
              d="M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Z"
              fill="currentColor"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M21.5 14.8a8.6 8.6 0 0 1-10.9-10.9a.9.9 0 0 0-1.2-1.06A9.9 9.9 0 1 0 22.56 16a.9.9 0 0 0-1.06-1.2Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button class="btn btn-secondary btn-small" @click="openLogoutConfirm" :disabled="isLoading">
          Logout
        </button>
      </div>
    </div>
  </nav>

  <Teleport to="body">
    <div
      v-if="logoutConfirmOpen"
      class="logout-confirm-backdrop"
      role="presentation"
      @click.self="closeLogoutConfirm"
    >
      <div class="logout-confirm-dialog card" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
        <h3 id="logout-confirm-title" class="logout-confirm-title">Log out?</h3>
        <p class="logout-confirm-text">Are you sure you want to log out?</p>
        <div class="logout-confirm-actions">
          <button type="button" class="btn btn-secondary" :disabled="isLoading" @click="closeLogoutConfirm">
            Cancel
          </button>
          <button type="button" class="btn btn-primary" :disabled="isLoading" @click="confirmLogout">
            <span v-if="isLoading" class="logout-spinner" aria-hidden="true"></span>
            <span>{{ isLoading ? 'Logging out…' : 'Yes, log out' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import FacebookLoginButton from './FacebookLoginButton.vue'

const props = defineProps({
  user: {
    type: Object,
    required: false,
    default: null
  },
  isAuthenticated: {
    type: Boolean,
    required: true
  },
  isLoading: {
    type: Boolean,
    required: false,
    default: false
  },
  sdkPreparing: {
    type: Boolean,
    default: false
  },
  theme: {
    type: String,
    default: 'system'
  }
})

const emit = defineEmits(['login', 'logout', 'toggle-theme'])

const handleLoginClick = () => {
  emit('login')
}

const logoutConfirmOpen = ref(false)

const openLogoutConfirm = () => {
  logoutConfirmOpen.value = true
}

const closeLogoutConfirm = () => {
  if (props.isLoading) return
  logoutConfirmOpen.value = false
}

const confirmLogout = () => {
  emit('logout')
}

watch(
  () => props.isLoading,
  (loading) => {
    if (!loading) logoutConfirmOpen.value = false
  }
)
</script>

<style scoped>
.navbar {
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: var(--spacing-md) var(--spacing-xl);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 10;
}

.navbar-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
}

.navbar-logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--primary);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.navbar-logo:hover {
  opacity: 0.8;
}

.navbar-logo svg {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.navbar-spacer {
  flex: 1;
}

.navbar-auth {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
  max-width: 280px;
}

.navbar-auth-hint {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--text-secondary);
  text-align: right;
}

@media (max-width: 768px) {
  .navbar-auth {
    max-width: 200px;
  }

  .navbar-auth-hint {
    display: none;
  }
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.theme-toggle-icon {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 999px;
  line-height: 0;
}

.theme-toggle-icon svg {
  width: 18px;
  height: 18px;
  display: block;
}

.theme-toggle-icon:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 70%, white);
  outline-offset: 2px;
}

.navbar-user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.navbar-user-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background-color: var(--bg-tertiary);
  flex-shrink: 0;
}

.avatar-placeholder {
  display: inline-block;
  border: 1px dashed var(--border);
}

.navbar-user-placeholder {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.logout-confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  z-index: 1000;
}

.logout-confirm-dialog {
  width: min(520px, 100%);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.logout-confirm-title {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: 1.125rem;
  color: var(--text-primary);
}

.logout-confirm-text {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--text-secondary);
  line-height: 1.45;
}

.logout-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.logout-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: rgba(255, 255, 255, 1);
  animation: logoutSpin 0.8s linear infinite;
  margin-right: 8px;
}

@keyframes logoutSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .navbar {
    padding: var(--spacing-md);
  }

  .navbar-wrapper {
    gap: var(--spacing-md);
  }

  .navbar-logo {
    font-size: 1rem;
  }

  .navbar-user-info {
    display: none;
  }

  .navbar-user {
    gap: var(--spacing-sm);
  }
}

@media (max-width: 480px) {
  .navbar {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .navbar-logo {
    font-size: 0.9rem;
  }

  .navbar-logo svg {
    width: 24px;
    height: 24px;
  }

  .navbar-user {
    gap: var(--spacing-xs);
  }

  .theme-toggle-icon {
    width: 38px;
    height: 38px;
    padding: 0;
  }

  .btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }
}
</style>
