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
        <span>Social Echo</span>
      </div>

      <div class="navbar-spacer"></div>

      <div v-if="!isAuthenticated" class="navbar-auth">
        <FacebookLoginButton
          :is-loading="isLoading"
          :sdk-preparing="sdkPreparing"
          @click="handleLoginClick"
        />
        <p class="navbar-auth-hint">
          Uses the Facebook sign-in window (like Google). New users can create a Facebook account from that same flow.
        </p>
      </div>

      <div v-else-if="user" class="navbar-user">
        <div class="navbar-user-info">
          <div class="navbar-user-name">{{ user.name }}</div>
          <div v-if="user.email" class="navbar-user-email">{{ user.email }}</div>
        </div>
        <img :src="user.picture" :alt="user.name" class="avatar" />
        <button class="btn btn-secondary btn-small" @click="handleLogout" :disabled="isLoading">
          {{ isLoading ? '...' : 'Logout' }}
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
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
  }
})

const emit = defineEmits(['login', 'logout'])

const handleLoginClick = () => {
  emit('login')
}

const handleLogout = () => emit('logout')
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

.navbar-user-email {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background-color: var(--bg-tertiary);
  flex-shrink: 0;
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

  .btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }
}
</style>
