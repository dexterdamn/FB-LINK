# Quick Start Guide - Social Echo

Get your Facebook cross-posting app running in minutes!

## 🚀 5-Minute Setup

### 1. Clone/Download the Project
```bash
cd social-echo
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

**That's it!** Your app is now running at `http://localhost:5173`

## 🎮 Using the App (Demo Mode)

1. **Click "Login with Facebook"** button
2. You'll be logged in automatically (demo mode)
3. **Type a post** in the text area
4. **Optionally add an image** by clicking "Choose Image"
5. **Click "Publish Post"** to create the post
6. **View all posts** in the feed on the right
7. **Interact with posts**: Like, Share, or Delete

## 📁 Project Structure at a Glance

```
📦 src/
├── 📂 components/       Vue components (login, posts, feed, navbar)
├── 📂 services/        Facebook & Storage services
├── 📂 composables/     Authentication & Posts state management
└── 📂 styles/          CSS files (organized by purpose)
```

## 🔧 Important Files

| File | Purpose |
|------|---------|
| `src/App.vue` | Main app component |
| `src/components/` | All Vue components |
| `src/services/facebookService.js` | Facebook API calls |
| `src/services/storageService.js` | Local storage management |
| `src/composables/useFacebookAuth.js` | Auth state |
| `src/composables/usePostStore.js` | Posts state |
| `src/styles/` | All CSS (variables, components, layout) |

## 🎨 Key Features

✅ **Facebook Login** - OAuth integration ready  
✅ **Create Posts** - Text + images  
✅ **Auto-Sync** - Posts publish to Facebook  
✅ **Feed** - See all your posts  
✅ **Interactions** - Like, share, delete  
✅ **Responsive** - Works on mobile too  
✅ **Persistent** - Posts saved locally  

## 🔐 Facebook Setup (Production)

For real Facebook posting:

1. Follow [FACEBOOK_SETUP.md](./FACEBOOK_SETUP.md)
2. Get your Facebook App ID
3. Add it to `.env` file:
   ```env
   VITE_FACEBOOK_APP_ID=your_app_id_here
   ```
4. Update `facebookService.js` with real API calls
5. Request proper permissions
6. Test and deploy!

## 📝 Common Tasks

### Create a New Component
```
src/components/MyComponent.vue
```

Create a `.vue` file with:
```vue
<template>
  <div>Hello</div>
</template>

<script setup>
// Your JavaScript here
</script>

<style scoped>
/* Component styles */
</style>
```

### Add a New Service
```
src/services/myService.js
```

```javascript
class MyService {
  // Your methods here
}

export const myService = new MyService()
```

### Use Authentication
```javascript
import { useFacebookAuth } from '@/composables/useFacebookAuth'

const { user, login, logout, isAuthenticated } = useFacebookAuth()
```

### Use Posts Data
```javascript
import { usePostStore } from '@/composables/usePostStore'

const { posts, addPost, deletePost, likePost } = usePostStore()
```

## 🎯 Next Steps

1. **Customize Styling**
   - Edit colors in `src/styles/variables.css`
   - Update fonts and spacing
   - Change layout in `src/styles/layout.css`

2. **Add Features**
   - Post scheduling
   - Image filters
   - Comment system
   - User profiles

3. **Connect Facebook**
   - Follow FACEBOOK_SETUP.md
   - Implement real API calls
   - Test with your account

4. **Deploy**
   ```bash
   npm run build
   # Upload dist/ folder to your server
   ```

## 📱 Mobile Development

The app is fully responsive! Test on mobile:

1. Start dev server
2. Get your machine's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
3. Open `http://YOUR_IP:5173` on your phone

## 🐛 Debugging Tips

### Check Console Logs
```javascript
// Use [v0] prefix for your debug logs
console.log('[v0] My debug message:', data)
```

### Vue DevTools
Install [Vue DevTools Browser Extension](https://devtools.vuejs.org/)

### Network Tab
- Open DevTools → Network tab
- Check API calls to Facebook
- See request/response data

### Local Storage
```javascript
// In browser console:
localStorage.getItem('social_echo_posts')  // View posts
localStorage.getItem('social_echo_user')   // View user data
```

## 📦 Build for Production

```bash
# Create optimized build
npm run build

# Preview the build locally
npm run preview

# Deploy dist/ folder to your hosting
```

## 🆘 Troubleshooting

### App Won't Start
```bash
npm run dev
# Check error message in terminal
# Usually: missing dependencies - run npm install
```

### Posts Not Saving
- Check browser localStorage
- Open DevTools → Application → Local Storage
- Verify data is being stored

### Styling Issues
- Check CSS variables in `variables.css`
- Make sure imports are in `global.css`
- Clear browser cache (Ctrl+Shift+R)

### Facebook Not Working
- Check `.env` file has App ID
- Verify Facebook SDK is loaded
- Check browser console for SDK errors

## 🔗 Helpful Links

- 📖 [README.md](./README.md) - Full documentation
- 🔐 [FACEBOOK_SETUP.md](./FACEBOOK_SETUP.md) - Facebook integration guide
- 💾 [Vue Docs](https://vuejs.org/)
- 🚀 [Vite Docs](https://vitejs.dev/)
- 🔷 [Facebook API Docs](https://developers.facebook.com/docs)

## 💡 Pro Tips

1. **Use `.env` file** for sensitive data
2. **Keep components small** - easier to maintain
3. **Test on real phone** - desktop looks different
4. **Use browser DevTools** - essential for debugging
5. **Commit often** - use Git for version control

## 🎓 Learning Path

1. ✅ Get app running (you're here!)
2. 📖 Read README.md for architecture
3. 🎨 Customize styling and colors
4. 🔐 Set up real Facebook integration
5. ✨ Add your own features
6. 🚀 Deploy to production

---

**You're all set!** 🎉

The app is running, and you can start creating posts. For real Facebook integration, check out [FACEBOOK_SETUP.md](./FACEBOOK_SETUP.md).

Happy coding! 💻
