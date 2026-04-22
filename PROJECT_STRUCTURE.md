# Project Structure - Social Echo

Complete breakdown of the Vue.js Facebook cross-posting app architecture.

## 📂 Directory Tree

```
social-echo/
│
├── 📄 index.html                 # HTML entry point
├── 📄 package.json              # Dependencies and scripts
├── 📄 vite.config.js           # Vite build configuration
├── 📄 .env.example              # Environment variables template
├── 📄 tsconfig.json            # TypeScript config (optional)
│
├── 📁 src/                       # Application source code
│   ├── 📄 main.js               # Vue app bootstrap
│   ├── 📄 App.vue               # Root component
│   │
│   ├── 📁 components/           # Vue components
│   │   ├── 📄 NavBar.vue       # Top navigation bar
│   │   ├── 📄 LoginComponent.vue    # Facebook login screen
│   │   ├── 📄 PostCreator.vue      # Post creation form
│   │   ├── 📄 PostCard.vue         # Individual post display
│   │   └── 📄 PostFeed.vue         # Posts feed container
│   │
│   ├── 📁 services/             # Business logic
│   │   ├── 📄 facebookService.js   # Facebook API integration
│   │   └── 📄 storageService.js    # Local storage operations
│   │
│   ├── 📁 composables/          # Vue 3 composition functions
│   │   ├── 📄 useFacebookAuth.js   # Authentication state
│   │   └── 📄 usePostStore.js      # Posts data management
│   │
│   └── 📁 styles/               # CSS files
│       ├── 📄 global.css        # Reset & base styles
│       ├── 📄 variables.css     # CSS custom properties
│       ├── 📄 components.css    # Component styles
│       └── 📄 layout.css        # Layout utilities
│
├── 📁 public/                    # Static assets
│   └── 📄 vite.svg             # Logo
│
└── 📄 README.md                 # Full documentation
    📄 QUICKSTART.md            # Quick start guide
    📄 FACEBOOK_SETUP.md        # Facebook integration guide
    📄 PROJECT_STRUCTURE.md     # This file
```

## 🔄 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      App.vue (Root)                          │
│  - Manages isUserLoggedIn state                             │
│  - Routes between Login and Main app                        │
└─────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼─────┐   ┌─────▼──────┐   ┌────▼──────┐
    │  NavBar   │   │PostCreator │   │ PostFeed  │
    │           │   │            │   │           │
    │ useFace   │   │ useFace    │   │ usePost   │
    │ bookAuth  │   │ bookAuth   │   │ Store     │
    └────┬─────┘   │ usePost    │   │ useFace   │
         │         │ Store      │   │ bookAuth  │
         │         └─────┬──────┘   └────┬──────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼─────────┐  ┌─▼──────────┐  ┌─▼─────────┐
    │useFacebook   │  │usePostStore│  │storageService│
    │Auth          │  │            │  │(localStorage) │
    │(Auth state)  │  │(Posts state)   │              │
    └────┬─────────┘  └─┬──────────┘  └──┬──────────┘
         │              │                 │
         └──────────────┼─────────────────┘
                        │
         ┌──────────────▼──────────────┐
         │  facebookService.js         │
         │  (Facebook API calls)       │
         │  - login()                  │
         │  - publishPost()            │
         │  - deletePost()             │
         │  - likePost()               │
         └─────────────────────────────┘
```

## 📦 File Purposes

### Entry Files

**index.html**
- Main HTML file
- Mounts Vue app to `#app` div
- Loads Facebook SDK
- Sets meta tags for SEO

**src/main.js**
- Creates Vue app instance
- Mounts App.vue to DOM
- Single line: `app.mount('#app')`

### Root Component

**src/App.vue** (61 lines)
- Authentication routing logic
- Conditional rendering (login vs main app)
- Event handling for login/logout
- Imports all child components
- State management integration

### Components (UI Layer)

| Component | Lines | Purpose |
|-----------|-------|---------|
| NavBar.vue | 189 | User profile bar, logout button |
| LoginComponent.vue | 221 | Beautiful login screen with features |
| PostCreator.vue | 271 | Form to create posts with images |
| PostCard.vue | 433 | Individual post display and interactions |
| PostFeed.vue | 199 | Container for all posts with sorting |

### Services (Business Logic)

**facebookService.js** (327 lines)
```
Handles all Facebook interactions:
├── Authentication
│   ├── login() - OAuth login
│   ├── logout() - Sign out
│   └── getUserInfo() - Fetch user profile
├── Post Management
│   ├── publishPost() - Create new post
│   ├── deletePost() - Remove post
│   ├── getFacebookPosts() - Fetch posts
│   └── likePost() - Like interaction
└── Sharing
    ├── sharePost() - Share to timeline
    └── Helper methods for API calls
```

**storageService.js** (270 lines)
```
Local storage operations:
├── Post Operations
│   ├── savePosts() - Save all
│   ├── getPosts() - Retrieve all
│   ├── addPost() - Add single
│   ├── updatePost() - Modify
│   └── deletePost() - Remove
├── User Operations
│   ├── saveUser() - Store user
│   ├── getUser() - Retrieve user
│   └── clearUser() - Remove user
├── Data Management
│   ├── exportData() - Export as JSON
│   ├── importData() - Import JSON
│   ├── clearAllData() - Reset app
│   └── getStorageStats() - Get size info
└── Settings
    ├── saveSettings() - Store settings
    └── getSettings() - Get settings
```

### Composables (State Management)

**useFacebookAuth.js** (161 lines)
```
Authentication state and operations:
├── State Variables
│   ├── user (ref) - Current user object
│   ├── isAuthenticated (ref) - Login status
│   ├── isLoading (ref) - Loading state
│   └── error (ref) - Error messages
├── Methods
│   ├── login() - Authenticate user
│   ├── logout() - Sign out
│   ├── updateUserProfile() - Edit profile
│   └── clearError() - Reset errors
└── Computed Properties
    ├── isLoggedIn - Auth status
    ├── currentUser - User object
    ├── authError - Error state
    └── authLoading - Loading state
```

**usePostStore.js** (290 lines)
```
Posts state management:
├── State Variables
│   ├── posts (ref) - All posts array
│   ├── isLoading (ref) - Loading state
│   └── error (ref) - Error messages
├── Core Methods
│   ├── loadPosts() - Load from storage
│   ├── addPost() - Create new post
│   ├── updatePost() - Modify post
│   ├── deletePost() - Remove post
│   └── getPostById() - Fetch single post
├── Interaction Methods
│   ├── likePost() - Add like
│   ├── sharePost() - Add share count
│   ├── addComment() - Add comment
│   └── searchPosts() - Search posts
├── Utility Methods
│   ├── clearPosts() - Reset all
│   ├── clearError() - Reset errors
│   └── getStorageStats() - Get size
└── Computed Properties
    ├── postsCount - Total posts
    ├── mostLikedPost - Top post
    └── postsStats - Statistics
```

### Styles (CSS Layer)

**styles/global.css** (119 lines)
```
Base styles:
├── Reset
│   ├── * { margin: 0, padding: 0 }
│   └── box-sizing: border-box
├── Typography
│   ├── Font family
│   ├── Heading styles (h1-h6)
│   └── Line heights
├── Forms
│   ├── Input styling
│   ├── Textarea
│   ├── Select boxes
│   └── Focus states
├── Links
│   └── Color & hover
└── Utility
    ├── Scrollbar styling
    └── Image defaults
```

**styles/variables.css** (78 lines)
```
CSS custom properties:
├── Colors
│   ├── Primary (brand color)
│   ├── Accent (highlight)
│   ├── Success/Error
│   └── Background & Text
├── Spacing Scale
│   ├── xs to 2xl
│   └── Consistent spacing
├── Shadows
│   ├── Small, medium, large
│   └── Depth effects
├── Radius
│   ├── Small to XL
│   └── Border rounding
└── Z-index
    ├── Dropdowns
    ├── Modals
    └── Tooltips
```

**styles/components.css** (313 lines)
```
Reusable component styles:
├── Buttons
│   ├── Primary, secondary, danger
│   ├── Small, large variants
│   └── States (hover, active, disabled)
├── Cards
│   ├── Container styling
│   ├── Header, body, footer
│   └── Hover effects
├── Forms
│   ├── Groups, labels
│   ├── Input styling
│   ├── Focus states
│   └── Error handling
├── Media
│   ├── Avatars
│   ├── Image previews
│   └── Thumbnails
└── Feedback
    ├── Messages (success, error, info)
    ├── Badges
    ├── Spinners
    └── Loading states
```

**styles/layout.css** (299 lines)
```
Layout utilities:
├── Main Layout
│   ├── App container flex
│   ├── Main content constraints
│   └── Responsive grid
├── Navbar
│   ├── Sticky positioning
│   ├── Flex layout
│   └── User section alignment
├── Grids
│   ├── Auto-fit grids
│   ├── Responsive columns
│   └── Gaps
├── Flexbox Utilities
│   ├── flex, flex-col
│   ├── Alignment (center, between)
│   └── Gaps (sm to xl)
├── Spacing Utilities
│   ├── Margin (mt, mb)
│   ├── Padding (px, py)
│   └── Gap classes
├── Text Utilities
│   ├── Text alignment
│   ├── Font sizes
│   ├── Font weights
│   └── Color variants
└── Responsive
    ├── Mobile breakpoints
    ├── Tablet adjustments
    └── Desktop optimizations
```

## 🔗 Component Relationships

```
App.vue (Root)
│
├── NavBar.vue (shown when logged in)
│   └── uses: useFacebookAuth
│
├── LoginComponent.vue (shown when logged out)
│   └── emits: login event
│
└── (Logged in) Main Content
    │
    ├── PostCreator.vue
    │   ├── uses: useFacebookAuth
    │   ├── uses: usePostStore
    │   ├── uses: facebookService
    │   └── emits: post-created
    │
    └── PostFeed.vue
        └── renders: PostCard.vue (multiple)
            ├── uses: usePostStore
            ├── uses: useFacebookAuth
            └── emits: post-deleted
```

## 💾 Data Storage Hierarchy

```
localStorage
│
├── social_echo_user
│   ├── id
│   ├── name
│   ├── email
│   ├── picture (avatar URL)
│   └── accessToken
│
├── social_echo_posts (Array)
│   └── Post Object
│       ├── id
│       ├── content
│       ├── image (base64 data)
│       ├── createdAt
│       ├── likes
│       ├── shares
│       ├── comments (Array)
│       └── facebookUrl
│
└── social_echo_settings
    ├── theme
    ├── sortBy
    └── preferences
```

## 🔐 Security Layers

```
User Input
    │
    ├── Component Validation
    │   └── Form checks (length, type)
    │
    ├── Service Validation
    │   └── Business logic checks
    │
    └── Storage Validation
        └── Data integrity checks
```

## 🎯 State Management Flow

```
User Action (Click, Input)
    │
    ▼
Component Event Handler
    │
    ├─▶ Composable Method
    │   │
    │   ├─▶ Service Method
    │   │   │
    │   │   └─▶ API/Storage Call
    │   │
    │   └─▶ Update Local State
    │
▼
Component Re-renders (reactive)
    │
    ├─▶ UI Updates
    ├─▶ Props Pass Down
    └─▶ Events Bubble Up
```

## 📊 Component Size Breakdown

| Component | Lines | Size |
|-----------|-------|------|
| App.vue | 61 | Small |
| NavBar.vue | 189 | Medium |
| LoginComponent.vue | 221 | Medium |
| PostCreator.vue | 271 | Medium-Large |
| PostCard.vue | 433 | Large |
| PostFeed.vue | 199 | Medium |
| facebookService.js | 327 | Large |
| storageService.js | 270 | Medium-Large |
| useFacebookAuth.js | 161 | Medium |
| usePostStore.js | 290 | Medium-Large |
| **Total** | **2,422** | **~2.4K LOC** |

## 🎨 Styling Breakdown

| File | Lines | Purpose |
|------|-------|---------|
| global.css | 119 | Base styles |
| variables.css | 78 | Design tokens |
| components.css | 313 | Component styles |
| layout.css | 299 | Layout utilities |
| **Total CSS** | **809** | Clean, organized |

## 🚀 Performance Considerations

1. **Code Splitting**: Vite auto-splits components
2. **Lazy Loading**: Implement route-based loading
3. **Caching**: Browser caches static assets
4. **Local Storage**: Reduces API calls
5. **CSS Variables**: Minimal repaints on theme changes

## 🔄 Development Workflow

1. Edit files in `src/`
2. Vite Hot Module Replacement (HMR) updates instantly
3. Browser auto-refreshes
4. No build step needed during development
5. Run `npm run build` for production

## 📈 Scalability

**Current Architecture allows for:**
- Multiple post types (text, image, video)
- User profiles and social features
- Comment threads
- Hashtags and trending
- Analytics and statistics
- Multi-platform integration (Instagram, Twitter)

**Without major refactoring!**

---

**Next Steps:**
- Read [README.md](./README.md) for full documentation
- Check [QUICKSTART.md](./QUICKSTART.md) to start coding
- Follow [FACEBOOK_SETUP.md](./FACEBOOK_SETUP.md) for production
