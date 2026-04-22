# Social Echo - Facebook Cross-Post App

A clean, organized Vue.js application that allows users to create posts and automatically sync them to Facebook. Posts are stored locally and displayed in a feed.

## 🎯 Features

- **Facebook OAuth Login** - Secure authentication with Facebook accounts
- **Post Creation** - Create posts with text and optional images
- **Facebook Integration** - Automatically publish posts to your Facebook timeline
- **Post Feed** - View all your posts in a chronological feed
- **Social Features** - Like, share, and interact with posts
- **Local Storage** - Posts persist across browser sessions
- **Responsive Design** - Works seamlessly on desktop and mobile devices

## 📁 Project Structure

```
src/
├── components/           # Vue components
│   ├── App.vue          # Main application component
│   ├── LoginComponent.vue    # Facebook login interface
│   ├── PostCreator.vue      # Post creation form
│   ├── PostCard.vue         # Individual post display
│   ├── PostFeed.vue         # Feed of all posts
│   └── NavBar.vue           # Navigation bar with user info
├── services/             # Business logic services
│   ├── facebookService.js   # Facebook API integration
│   └── storageService.js    # Local storage management
├── composables/          # Vue 3 composition functions
│   ├── useFacebookAuth.js   # Authentication state
│   └── usePostStore.js      # Posts state management
├── styles/              # Organized CSS files
│   ├── global.css       # Reset and base styles
│   ├── variables.css    # CSS custom properties
│   ├── components.css   # Component-specific styles
│   └── layout.css       # Layout utilities
├── main.js             # Application entry point
└── App.vue             # Root component

public/                  # Static assets
index.html              # HTML entry point
vite.config.js          # Vite configuration
package.json            # Dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm/pnpm
- Facebook App ID (for production use)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   VITE_FACEBOOK_APP_ID=your_facebook_app_id
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:5173`

## 📝 Component Overview

### LoginComponent.vue
Handles Facebook OAuth login with a beautiful gradient UI. Shows app features and prompts users to authenticate.

**Features:**
- Facebook login button
- Feature list display
- Error handling
- Loading states

### PostCreator.vue
Form for creating new posts with text and optional image uploads.

**Features:**
- Textarea with character counter
- Image upload with preview
- Image removal
- Form validation
- Success/error messages
- Auto-publish to Facebook

### PostCard.vue
Displays individual posts with interactions and sharing options.

**Features:**
- User info and timestamp
- Post content with image
- Like functionality
- Share menu (WhatsApp, Twitter, Copy link)
- Delete option
- Engagement statistics

### PostFeed.vue
Displays all posts with sorting and filtering options.

**Features:**
- Sort by newest or popular
- Empty state display
- Post list management
- Loading indicators

### NavBar.vue
Navigation bar showing user profile and logout option.

**Features:**
- User avatar and name
- Email display
- Logout button
- Sticky positioning

## 🔧 Service Architecture

### facebookService.js
Manages all Facebook API interactions.

**Key Methods:**
- `login()` - Authenticate with Facebook
- `logout()` - Sign out user
- `publishPost(postData)` - Create a post on Facebook
- `getFacebookPosts()` - Fetch user's Facebook posts
- `deletePost(postId)` - Delete a post
- `likePost(postId)` - Like a post
- `sharePost(postId, message)` - Share a post

### storageService.js
Handles local storage operations for persistence.

**Key Methods:**
- `savePosts(posts)` - Save all posts
- `getPosts()` - Retrieve all posts
- `addPost(post)` - Add single post
- `updatePost(postId, updates)` - Update post data
- `deletePost(postId)` - Remove a post
- `saveUser(user)` - Store user data
- `getUser()` - Retrieve user data
- `exportData()` - Export all app data as JSON
- `importData(data)` - Import data from JSON

## 🧩 Composables

### useFacebookAuth.js
Manages authentication state and operations.

```javascript
const { 
  user,
  isAuthenticated,
  login,
  logout,
  updateUserProfile,
  isLoggedIn,
  currentUser,
  authError,
  authLoading
} = useFacebookAuth()
```

### usePostStore.js
Manages posts state and operations.

```javascript
const {
  posts,
  loadPosts,
  addPost,
  updatePost,
  deletePost,
  likePost,
  sharePost,
  searchPosts,
  postsCount,
  postsStats
} = usePostStore()
```

## 🎨 Styling Architecture

The app uses a custom CSS system with organized files:

### CSS Variables (variables.css)
Define all colors, spacing, shadows, and sizing:
- Primary colors: `--primary`, `--primary-light`, `--primary-dark`
- Accent colors: `--accent`, `--accent-light`, `--accent-dark`
- Backgrounds: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
- Text colors: `--text-primary`, `--text-secondary`, `--text-tertiary`
- Spacing scale: `--spacing-xs` through `--spacing-2xl`

### Global Styles (global.css)
Base styles for HTML elements, typography, forms, and resets.

### Component Styles (components.css)
Reusable component classes:
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
- `.card`, `.card-header`, `.card-body`, `.card-footer`
- `.form-group`, `.form-label`, `.form-input`, `.form-textarea`
- `.badge`, `.spinner`, `.message`, `.divider`

### Layout Utilities (layout.css)
Flexbox and grid utilities, spacing, text, and responsive helpers.

## 🔐 Security Considerations

### Current Implementation
- Demo mode with simulated Facebook authentication
- Local storage for data persistence
- Form validation on the client side

### Production Implementation Checklist
- [ ] Implement real Facebook OAuth flow
- [ ] Use secure session tokens
- [ ] Implement HTTPS everywhere
- [ ] Add CSRF protection
- [ ] Validate all inputs server-side
- [ ] Implement rate limiting
- [ ] Add proper error logging
- [ ] Secure sensitive data with encryption
- [ ] Regular security audits

## 🚢 Building for Production

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Preview the build:**
   ```bash
   npm run preview
   ```

3. **Deploy to your hosting:**
   - Upload the `dist/` folder to your server
   - Configure environment variables
   - Set up proper HTTPS
   - Configure Facebook app settings

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## 🔄 State Management Flow

```
User Login
    ↓
useFacebookAuth (stores auth state)
    ↓
storageService (persists user data)
    ↓
App shows NavBar + PostCreator + PostFeed
    ↓
Create Post
    ↓
facebookService.publishPost()
    ↓
usePostStore.addPost()
    ↓
storageService.savePosts()
    ↓
PostFeed updates reactively
```

## 🐛 Debugging

Enable debug logs by adding `[v0]` prefix to console messages:

```javascript
console.log('[v0] User data:', userData)
console.log('[v0] Post created:', postData)
```

## 📦 Dependencies

### Core
- **Vue 3** - Progressive JavaScript framework
- **Vite** - Lightning-fast build tool

### No external UI frameworks
Built with custom, clean CSS for full control and minimal dependencies.

## 🤝 Contributing

To extend the app:

1. **Add new components** in `src/components/`
2. **Add new services** in `src/services/`
3. **Add new composables** in `src/composables/`
4. **Update styles** in `src/styles/`

Follow the existing patterns for consistency.

## 📄 Environment Variables

```env
# Facebook App Configuration
VITE_FACEBOOK_APP_ID=your_app_id

# API Endpoints (for production)
VITE_API_BASE_URL=https://api.example.com
VITE_FACEBOOK_API_VERSION=v18.0
```

## 🎓 Learning Resources

- [Vue 3 Docs](https://vuejs.org/)
- [Vite Docs](https://vitejs.dev/)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api/)
- [JavaScript Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)

## 📞 Support

For issues or questions:
1. Check the component documentation above
2. Review the service implementations
3. Check browser console for error messages
4. Ensure Facebook App ID is correctly configured

## 📄 License

This project is open source and available under the MIT License.

## ✨ Features Roadmap

- [ ] User settings and preferences
- [ ] Post scheduling
- [ ] Multi-image posts
- [ ] Instagram integration
- [ ] Twitter integration
- [ ] Post analytics
- [ ] Hashtag support
- [ ] Post categories/tags
- [ ] Comment system
- [ ] Dark mode

---

**Social Echo** - Post once, share everywhere! 🚀
