# Facebook Integration Setup Guide

This guide will walk you through setting up real Facebook OAuth integration for the Social Echo app.

## 📋 Prerequisites

- A Facebook Developer Account (create at [developers.facebook.com](https://developers.facebook.com))
- Your app domain/URL ready
- Basic understanding of OAuth 2.0

## 🔧 Step 1: Create a Facebook App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click "My Apps" → "Create App"
3. Choose **"Consumer"** as the app type
4. Fill in app name, contact email, and app purpose
5. Click "Create App"

## 📱 Step 2: Configure App Settings

1. In your app dashboard, go to **Settings** → **Basic**
2. Copy your **App ID** and **App Secret**
3. Add your app domain under **App Domains**
   - Development: `localhost:5173`
   - Production: `yourdomain.com`
4. Add platform:
   - Click **+ Add Platform**
   - Select **Website**
   - Enter your domain URL

## 🔑 Step 3: Set Up Facebook Login

### In Your Facebook App Dashboard:

1. Navigate to **Products** and find **Facebook Login**
2. Click **Set Up**
3. Choose **Web** as your platform
4. Add OAuth Redirect URLs in **Settings** → **Basic**:
   ```
   http://localhost:8000/
   http://localhost:8000/callback
   https://yourdomain.com/
   https://yourdomain.com/callback
   ```

### Get Required Credentials:

1. Go to **Settings** → **Basic**
   - Copy **App ID**: `YOUR_APP_ID`
   - Copy **App Secret**: `YOUR_APP_SECRET` (keep this private!)

2. Go to **Facebook Login** → **Settings**
   - Verify OAuth Redirect URLs are set correctly
   - Valid OAuth Redirect URIs should include your callback URLs

## 🔐 Step 4: Update Environment Variables

Create a `.env` file in the project root:

```env
VITE_FACEBOOK_APP_ID=YOUR_APP_ID_HERE
VITE_FACEBOOK_APP_SECRET=YOUR_APP_SECRET_HERE
VITE_API_BASE_URL=http://localhost:5173
VITE_FACEBOOK_API_VERSION=v18.0
```

## 🌐 Step 5: Update HTML File

Add the Facebook SDK to your `index.html`:

```html
<script>
  window.fbAsyncInit = function() {
    FB.init({
      appId: 'YOUR_APP_ID',
      xfbml: true,
      version: 'v18.0'
    });
  };
</script>
<script async defer crossorigin="anonymous" 
  src="https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0">
</script>
```

## 💻 Step 6: Update Facebook Service

Update `src/services/facebookService.js` to use real Facebook SDK:

```javascript
// Uncomment and implement real Facebook login
const handleFacebookLogin = async () => {
  return new Promise((resolve) => {
    FB.login((response) => {
      if (response.authResponse) {
        const { accessToken, userID } = response.authResponse;
        
        // Get user details
        FB.api('/me', { fields: 'id,name,email,picture' }, (userInfo) => {
          resolve({
            success: true,
            user: {
              id: userInfo.id,
              name: userInfo.name,
              email: userInfo.email,
              picture: userInfo.picture.data.url,
              accessToken: accessToken
            }
          });
        });
      } else {
        resolve({
          success: false,
          error: 'Login cancelled'
        });
      }
    }, { scope: 'public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts', return_scopes: true });
  });
};
```

## 📤 Step 7: Implement Real Post Publishing

This app publishes **to a Facebook Page** using a **Page access token** (not a user token).

- Get a user token via `FB.login(...)`
- Exchange it for Pages via `GET /me/accounts` (each Page row includes `access_token`)
- Publish with `POST /{page-id}/feed` using that Page token

The current `publishPost` implementation in `src/services/facebookService.js` already follows this flow.

```javascript
async publishPost(postData) {
  try {
    const { content, image } = postData;

    // Prepare form data
    const formData = new FormData();
    formData.append('message', content);
    formData.append('access_token', this.accessToken);

    // If image is included
    if (image) {
      formData.append('source', image);
    }

    // Call Facebook Graph API
    // IMPORTANT: this endpoint requires the *Page ID* and a *Page access token*
    const pageId = this.selectedPageId;
    const pageAccessToken = this.pageAccessToken;
    formData.set('access_token', pageAccessToken);

    const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.id) {
      return {
        success: true,
        postId: data.id,
        facebookUrl: `https://www.facebook.com/${data.id}`
      };
    } else {
      return {
        success: false,
        error: data.error?.message || 'Failed to publish post'
      };
    }
  } catch (error) {
    console.error('Error publishing post:', error);
    return {
      success: false,
      error: 'Failed to publish post'
    };
  }
}
```

## 🔒 Step 8: Request Required Permissions

Your app needs these permissions to work properly:

1. **public_profile** - Access user's profile
2. **email** - Get user's email address
3. **pages_show_list** - List Pages the user manages (so you can pick a Page)
4. **pages_read_engagement** - Read basic Page feed fields/engagement (if you display posts)
5. **pages_manage_posts** - Publish posts to a Page feed

To request permissions, update the FB.login scope:

```javascript
FB.login((response) => {
  // ...
}, {
  scope: 'public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts',
  return_scopes: true
});
```

## ✅ Step 9: Test the Integration

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Click "Login with Facebook" button
3. Grant permissions when prompted
4. Create a test post
5. Check your Facebook timeline to verify it was published

## 🚀 Step 10: Go Live (Production)

### Before deploying:

1. **App Review**
   - Submit your app for review if using production scope
   - Provide clear descriptions of how you use each permission

2. **Update Settings**
   - Change App Mode from Development to Live
   - Update all URLs to production domain
   - Remove localhost from App Domains

3. **Security Checklist**
   - Verify HTTPS is enabled
   - Rotate your App Secret
   - Never commit `.env` file with real secrets
   - Use environment variables only

4. **Configure in Production**
   ```env
   VITE_FACEBOOK_APP_ID=YOUR_PRODUCTION_APP_ID
   VITE_API_BASE_URL=https://yourdomain.com
   ```

## 🐛 Troubleshooting

### "App Not Set Up" Error
- Verify App ID is correct in `.env`
- Check if app is in development mode
- Ensure your domain is added to App Domains

### "Invalid OAuth Redirect URL"
- Check callback URLs in Facebook App Settings
- Ensure the exact URL matches what's configured
- Try without trailing slashes

### "Permission Denied" Error
- Request additional permissions in FB.login scope
- Make sure app is approved for those permissions
- Check user's privacy settings on Facebook

### Posts Not Publishing
- Verify user has granted `publish_pages` permission
- Check Facebook API rate limits
- Ensure access token is valid

## 📚 Useful Resources

- [Facebook Graph API Documentation](https://developers.facebook.com/docs/graph-api)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Facebook Permissions Reference](https://developers.facebook.com/docs/permissions/reference)
- [Facebook API Versioning](https://developers.facebook.com/docs/graph-api/versions)

## 🔗 API Endpoints Reference

### Get User Info
```
GET /me?fields=id,name,email,picture
```

### Publish Feed Post
```
POST /{user-id}/feed
Parameters:
  - message: string
  - source: file (image)
  - link: string (optional)
```

### Get User's Posts
```
GET /{user-id}/feed?fields=id,message,created_time,picture
```

### Delete Post
```
DELETE /{post-id}
```

### Like Post
```
POST /{post-id}/likes
```

### Get Comments
```
GET /{post-id}/comments?fields=id,message,from,created_time
```

## 💡 Best Practices

1. **Token Management**
   - Store access tokens securely (not in localStorage)
   - Refresh tokens before they expire
   - Revoke tokens on logout

2. **Error Handling**
   - Always handle API errors gracefully
   - Provide user-friendly error messages
   - Log errors for debugging

3. **Rate Limiting**
   - Implement request queuing
   - Respect Facebook's rate limits
   - Cache responses when possible

4. **User Privacy**
   - Request only necessary permissions
   - Be transparent about data usage
   - Comply with GDPR/privacy laws

5. **Testing**
   - Use Facebook's batch API for testing
   - Create test accounts
   - Use sandbox environment before production

---

**Need Help?**
Check the [Facebook Developers Community](https://developers.facebook.com/community/) or visit [Stack Overflow](https://stackoverflow.com/questions/tagged/facebook-graph-api)
