/**
 * Facebook Pages — three integration layers used here:
 * 1) Access tokens — FB.login → user access token → GET /me/accounts → Page access_token
 * 2) Graph API — GET/POST/DELETE on Page objects (Page token on every request)
 * 3) Webhooks — not in this SPA; needs a public HTTPS backend + App Dashboard subscription
 *
 * Endpoints (Graph):
 * - GET  /{page-id}?fields=id,name,about,fan_count
 * - GET  /{page-id}/feed?fields=…
 * - GET  /{post-id}?fields=…
 * - POST /{page-id}/feed — message, link, picture, published
 * - POST /{page-id}/photos — multipart (local image)
 * - POST /{post-id} — update message where supported
 * - DELETE /{post-id}
 */

/**
 * OAuth scope string for FB.login.
 * If Meta shows "Invalid Scopes: email, pages_…", those permissions are not enabled
 * for this app in the Developer Console (Use cases → Pages / posting, then
 * Permissions and features). See: https://developers.facebook.com/docs/permissions
 *
 * Optional: set VITE_FACEBOOK_LOGIN_SCOPES to override the entire list (e.g. test with
 * "public_profile" only, then add permissions that appear as enabled in your app).
 */
function buildLoginScopes() {
  const override = String(import.meta.env.VITE_FACEBOOK_LOGIN_SCOPES || '').trim()
  if (override) return override

  const base = [
    'public_profile',
    'email'
  ]
  const extra = String(import.meta.env.VITE_FACEBOOK_EXTRA_SCOPES || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const merged = [...base, ...extra]
  return [...new Set(merged)].join(',')
}

class FacebookService {
  constructor() {
    this.appId = String(import.meta.env.VITE_FACEBOOK_APP_ID || '').trim()
    this.apiVersion = import.meta.env.VITE_FACEBOOK_API_VERSION || 'v18.0'
    this.userAccessToken = null
    this.userId = null
    this.pages = []
    this.selectedPageId = null
    this.pageAccessToken = null
    this._sdkInitPromise = null
  }

  get graphBase() {
    return `https://graph.facebook.com/${this.apiVersion}`
  }

  getPageToken(pageId) {
    if (!pageId) return null
    const p = this.pages.find((x) => x.id === pageId)
    return p?.access_token || null
  }

  /**
   * Initialize Facebook JS SDK (single init)
   */
  initializeFacebookSDK() {
    if (this._sdkInitPromise) return this._sdkInitPromise

    this.appId = String(import.meta.env.VITE_FACEBOOK_APP_ID || '').trim()

    this._sdkInitPromise = new Promise((resolve, reject) => {
      const fail = (message) => reject(new Error(message))

      if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        fail(
          'Hindi gagana ang Facebook Login kapag naka-file://. Buksan ang app gamit ang dev server (hal. npm run dev → http://localhost:5173).'
        )
        return
      }

      if (typeof window !== 'undefined') {
        const { protocol, hostname, port } = window.location
        const isLocalhost =
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '[::1]' ||
          hostname === '0.0.0.0'
        if (protocol !== 'https:' && !isLocalhost) {
          fail(
            `Hindi na puwedeng tumawag ng FB.login sa HTTP pages. Buksan ang app sa HTTPS (hal. https://${hostname}${port ? `:${port}` : ''}). (Meta requires HTTPS for Facebook Login.)`
          )
          return
        }
      }

      if (!this.appId) {
        fail(
          'Walang VITE_FACEBOOK_APP_ID. Gumawa ng .env sa project root, idagdag ang ID, tapos i-restart ang Vite (npm run dev).'
        )
        return
      }

      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        fail(
          'Hindi na-load ang Facebook SDK sa loob ng 25s. Subukan: i-off ang ad blocker para sa connect.facebook.net, o tingnan ang internet.'
        )
      }, 25000)

      const done = (fn) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn()
      }

      const init = () => {
        try {
          if (!window.FB) {
            done(() => fail('Facebook SDK (FB) ay wala pa pagkatapos mag-load ng script.'))
            return
          }
          window.FB.init({
            appId: this.appId,
            cookie: true,
            xfbml: false,
            version: this.apiVersion
          })
          if (typeof window.FB.login !== 'function') {
            done(() => fail('Facebook SDK ay na-init pero walang FB.login — subukang i-refresh ang pahina.'))
            return
          }
          done(() => resolve())
        } catch (e) {
          done(() => reject(e))
        }
      }

      if (window.FB) {
        init()
        return
      }

      window.fbAsyncInit = init

      const existing = document.querySelector('script[src*="connect.facebook.net"][src*="sdk.js"]')
      if (existing) {
        if (window.FB) init()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://connect.facebook.net/en_US/sdk.js'
      script.async = true
      script.defer = true
      script.onerror = () =>
        done(() => fail('Bumagsak ang pag-load ng connect.facebook.net/sdk.js (ad blocker, CSP, o network).'))
      document.body.appendChild(script)
    })

    const p = this._sdkInitPromise
    p.catch(() => {
      this._sdkInitPromise = null
    })
    return p
  }

  /**
   * GET /me/permissions — which Graph permissions the user granted (requires user access token).
   */
  async getGrantedPermissions(userAccessToken = this.userAccessToken) {
    if (!userAccessToken) {
      return { success: false, error: 'No user access token', permissions: [] }
    }
    try {
      const res = await fetch(
        `${this.graphBase}/me/permissions?access_token=${encodeURIComponent(userAccessToken)}`
      )
      const data = await res.json()
      if (data.error) {
        return {
          success: false,
          error: data.error.message || 'Failed to load /me/permissions',
          permissions: []
        }
      }
      return { success: true, permissions: Array.isArray(data.data) ? data.data : [] }
    } catch (e) {
      return { success: false, error: e.message || 'Network error', permissions: [] }
    }
  }

  /**
   * Build a single object that describes the Facebook auth outcome for the Graph API
   * (user token + Page token path used by this app). The JS SDK returns a user access
   * token directly; the authorization-code step runs inside Facebook’s dialog, not in app code.
   */
  _buildAuthenticationPayload({
    requestedScopeString,
    authResponse = null,
    permResult,
    firstPage
  }) {
    const flowSteps = [
      {
        id: 'request_permissions',
        done: true,
        label: 'App requested the necessary permissions (Facebook login dialog).'
      },
      {
        id: 'user_authorized',
        done: true,
        label: 'User authorized the app.'
      },
      {
        id: 'user_access_token',
        done: !!this.userAccessToken,
        label:
          'User access token is available (JavaScript SDK: Facebook completes OAuth; there is no authorization code in your app code to exchange — that applies to the server-side manual OAuth flow).'
      },
      {
        id: 'page_access_token',
        done: !!this.pageAccessToken,
        label:
          'Page access token was loaded via GET /me/accounts with the user access token. Use it for Page endpoints (e.g. POST /{page-id}/feed).'
      }
    ]

    return {
      clientFlow: 'facebook_javascript_sdk',
      /** Short explanation for API integrators */
      howThisAppGetsTokens: {
        userAccessToken:
          'Returned by FB.login as authResponse.accessToken — used for /me, /me/permissions, and /me/accounts.',
        pageAccessToken:
          'Each item in /me/accounts includes access_token: that is the Page access token for posting to that Page.',
        postToPage:
          'POST https://graph.facebook.com/<version>/{page-id}/feed with access_token=<page_access_token> (see publishPost in this app).'
      },
      requestedScopes: requestedScopeString
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      grantedPermissions: (permResult?.permissions || [])
        .filter((p) => p.status === 'granted')
        .map((p) => p.permission),
      /** Full rows from Graph /me/permission (includes declined, etc.) */
      permissionsDetail: permResult?.permissions || [],
      userId: this.userId,
      userAccessToken: this.userAccessToken,
      pageAccessToken: this.pageAccessToken,
      selectedPage: firstPage
        ? { id: firstPage.id, name: firstPage.name, category: firstPage.category }
        : null,
      userAccessTokenExpiresInSeconds: authResponse?.expiresIn ?? null,
      dataAccessExpirationTime: authResponse?.data_access_expiration_time ?? null,
      flowSteps
    }
  }

  /**
   * Restore tokens from persisted user (localStorage)
   */
  hydrateFromUser(user) {
    if (!user) return
    this.userAccessToken = user.accessToken || null
    this.userId = user.id || null
    this.pages = Array.isArray(user.pages) ? user.pages : []
    const lguId = user.lguPage?.id != null && user.lguPage.id !== '' ? String(user.lguPage.id) : null
    const sel =
      lguId ||
      (user.selectedPageId != null && user.selectedPageId !== '' ? String(user.selectedPageId) : null)
    this.selectedPageId = sel
    this.pageAccessToken = user.pageAccessToken || null
    if (!this.pageAccessToken && sel && this.pages.length) {
      const p = this.pages.find((x) => String(x.id) === sel)
      if (p?.access_token) this.pageAccessToken = p.access_token
    }
  }

  clearSession() {
    this.userAccessToken = null
    this.userId = null
    this.pages = []
    this.selectedPageId = null
    this.pageAccessToken = null
  }

  /**
   * Facebook Login dialog (same OAuth window pattern as “Sign in with Google”).
   * Users without an account can use “Create new account” inside Facebook’s dialog.
   */
  async login() {
    try {
      await this.initializeFacebookSDK()

      if (!window.FB || typeof window.FB.login !== 'function') {
        return {
          success: false,
          error:
            'Handa na dapat ang Facebook SDK bago mag-login. I-refresh ang pahina o tingnan ang Console para sa error.'
        }
      }

      const requestedScopeString = buildLoginScopes()

      const auth = await new Promise((resolve) => {
        try {
          window.FB.login(
            (response) => {
              const ar = response?.authResponse
              const token = ar?.accessToken
              if (token) {
                resolve({
                  ok: true,
                  accessToken: token,
                  userId: ar.userID,
                  authResponse: ar
                })
                return
              }

              let msg =
                response?.status === 'not_authorized'
                  ? 'Hindi pinayagan ang app sa Facebook. Pindutin muli at tanggapin ang lahat ng hinihinging pahintulot (lalo na para sa Pages).'
                  : 'Kinansel ang login o walang token na bumalik. Subukan muli; tingnan din kung hindi na-block ang pop-up ng browser.'

              if (response?.errorMessage) {
                msg = `${msg} (${response.errorMessage})`
              }

              resolve({ ok: false, error: msg })
            },
            {
              scope: requestedScopeString,
              return_scopes: true
            }
          )
        } catch (e) {
          resolve({
            ok: false,
            error: e?.message || 'Hindi natuloy ang FB.login (maaaring na-block ang pop-up).'
          })
        }
      })

      if (!auth.ok) {
        return { success: false, error: auth.error }
      }

      this.userAccessToken = auth.accessToken
      this.userId = auth.userId
      const fbAuthResponse = auth.authResponse || null

      const profileRes = await fetch(
        `${this.graphBase}/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
          this.userAccessToken
        )}`
      )
      const profile = await profileRes.json()
      if (profile.error) {
        this.clearSession()
        return {
          success: false,
          error: profile.error.message || 'Could not load Facebook profile.'
        }
      }

      const permResult = await this.getGrantedPermissions(this.userAccessToken)

      const pagesRes = await fetch(
        `${this.graphBase}/me/accounts?fields=id,name,access_token,category&access_token=${encodeURIComponent(
          this.userAccessToken
        )}`
      )
      const pagesData = await pagesRes.json()
      if (pagesData.error) {
        return {
          success: false,
          error:
            pagesData.error.message ||
            'Could not load Pages. Ensure you manage at least one Facebook Page and permissions are granted.'
        }
      }

      this.pages = pagesData.data || []
      const first = this.pages[0]
      this.selectedPageId = first?.id || null
      this.pageAccessToken = first?.access_token || null

      const authentication = this._buildAuthenticationPayload({
        requestedScopeString,
        authResponse: fbAuthResponse,
        permResult: { permissions: permResult.success ? permResult.permissions : [] },
        firstPage: first
      })

      if (!permResult.success) {
        authentication.permissionsWarning = permResult.error
      }

      const user = {
        id: profile.id,
        name: profile.name,
        email: profile.email || '',
        picture: profile.picture?.data?.url || '',
        accessToken: this.userAccessToken,
        pages: this.pages.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          access_token: p.access_token
        })),
        selectedPageId: this.selectedPageId,
        pageAccessToken: this.pageAccessToken,
        /** Full Facebook / Graph “authentication” outcome: user token, Page token, permissions, and flow steps. */
        authentication
      }

      return { success: true, user, authentication }
    } catch (error) {
      console.error('Facebook login error:', error)
      this.clearSession()
      return {
        success: false,
        error: error.message || 'Failed to login with Facebook.'
      }
    }
  }

  /**
   * Log out of Facebook in the browser session (best-effort).
   */
  async logout() {
    try {
      await this.initializeFacebookSDK().catch(() => {})
      if (window.FB && this.userAccessToken) {
        await new Promise((resolve) => {
          window.FB.logout(() => resolve())
        })
      }
    } catch (e) {
      console.warn('FB.logout:', e)
    } finally {
      this.clearSession()
    }
    return { success: true }
  }

  setSelectedPage(pageId) {
    const id = String(pageId || '')
    const page = this.pages.find((p) => String(p.id) === id)
    if (!page?.access_token) return false
    this.selectedPageId = String(page.id)
    this.pageAccessToken = page.access_token
    return true
  }

  /**
   * GET /{page-id}?fields=id,name,about,fan_count
   */
  async getPageInfo(pageId = this.selectedPageId, pageToken = this.pageAccessToken) {
    if (!pageId || !pageToken) {
      return { success: false, error: 'Select a Page and sign in.', page: null }
    }
    try {
      const url = `${this.graphBase}/${encodeURIComponent(
        pageId
      )}?fields=id,name,about,fan_count&access_token=${encodeURIComponent(pageToken)}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) {
        return { success: false, error: data.error.message || 'Page info request failed.', page: null }
      }
      return { success: true, page: data }
    } catch (e) {
      return { success: false, error: e.message || 'Network error.', page: null }
    }
  }

  /**
   * POST /{page-id}/feed — message, link, picture, published (Page access token)
   * If `image` is a File, uses POST /{page-id}/photos instead.
   */
  async publishPostToPage({ pageId, pageAccessToken, postData }) {
    const {
      content,
      message,
      image,
      link,
      picture,
      published = true
    } = postData

    const text = (message ?? content ?? '').trim()
    if (!text && !link && !image) {
      return { success: false, error: 'Add a message, link, or image to publish.' }
    }

    if (!pageAccessToken || !pageId) {
      return {
        success: false,
        error: 'Missing Page target (pageId / pageAccessToken).'
      }
    }

    const token = pageAccessToken

    try {
      if (image instanceof File) {
        const form = new FormData()
        form.append('access_token', token)
        if (text) form.append('message', text)
        form.append('published', published ? 'true' : 'false')
        form.append('source', image)

        const res = await fetch(`${this.graphBase}/${encodeURIComponent(pageId)}/photos`, {
          method: 'POST',
          body: form
        })
        const data = await res.json()
        if (data.error) {
          return { success: false, error: data.error.message || 'Photo upload failed.' }
        }
        const postId = data.post_id || data.id
        const facebookUrl = postId ? this._permalinkFromPostId(postId) : null
        return { success: true, postId: postId || data.id, facebookUrl, raw: data }
      }

      const params = new URLSearchParams()
      params.set('access_token', token)
      if (text) params.set('message', text)
      if (link) params.set('link', link)
      if (picture) params.set('picture', picture)
      params.set('published', published ? 'true' : 'false')

      const res = await fetch(`${this.graphBase}/${encodeURIComponent(pageId)}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      })
      const data = await res.json()
      if (data.error) {
        return { success: false, error: data.error.message || 'Feed post failed.' }
      }
      const postId = data.id
      const facebookUrl = postId ? this._permalinkFromPostId(postId) : null
      return { success: true, postId, facebookUrl, raw: data }
    } catch (e) {
      console.error('publishPost:', e)
      return { success: false, error: e.message || 'Failed to publish.' }
    }
  }

  async publishPost(postData) {
    if (!this.pageAccessToken || !this.selectedPageId) {
      return {
        success: false,
        error: 'No Page selected. Log in and choose a Page you manage.'
      }
    }
    return this.publishPostToPage({
      pageId: this.selectedPageId,
      pageAccessToken: this.pageAccessToken,
      postData
    })
  }

  async getFacebookPosts() {
    if (!this.pageAccessToken || !this.selectedPageId) {
      return { success: false, error: 'Not authenticated for a Page.', posts: [] }
    }
    try {
      const fields = 'id,message,created_time,permalink_url'
      const url = `${this.graphBase}/${encodeURIComponent(
        this.selectedPageId
      )}/feed?fields=${fields}&access_token=${encodeURIComponent(this.pageAccessToken)}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) {
        return { success: false, error: data.error.message, posts: [] }
      }
      return { success: true, posts: data.data || [] }
    } catch (e) {
      return { success: false, error: e.message, posts: [] }
    }
  }

  /**
   * GET /{post-id}?fields=…
   */
  async getPost(postId, fields = 'id,message,created_time,permalink_url') {
    if (!this.pageAccessToken || !postId) {
      return { success: false, error: 'Not authenticated or missing post id.', post: null }
    }
    try {
      const url = `${this.graphBase}/${encodeURIComponent(postId)}?fields=${encodeURIComponent(
        fields
      )}&access_token=${encodeURIComponent(this.pageAccessToken)}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) {
        return { success: false, error: data.error.message || 'Get post failed.', post: null }
      }
      return { success: true, post: data }
    } catch (e) {
      return { success: false, error: e.message || 'Network error.', post: null }
    }
  }

  /**
   * POST /{post-id} — update fields supported for that post type (e.g. message).
   */
  async updatePost(postId, { message }) {
    if (!this.pageAccessToken || !postId) {
      return { success: false, error: 'Not authenticated or missing post id.' }
    }
    const text = (message ?? '').trim()
    if (!text) {
      return { success: false, error: 'Message is required to update a post.' }
    }
    try {
      const params = new URLSearchParams()
      params.set('access_token', this.pageAccessToken)
      params.set('message', text)
      const res = await fetch(`${this.graphBase}/${encodeURIComponent(postId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      })
      const data = await res.json()
      if (data.error) {
        return { success: false, error: data.error.message || 'Update post failed.' }
      }
      return { success: true, raw: data }
    } catch (e) {
      return { success: false, error: e.message || 'Network error.' }
    }
  }

  async deletePost(postId) {
    if (!this.pageAccessToken) {
      return { success: false, error: 'Not authenticated' }
    }
    try {
      const url = `${this.graphBase}/${encodeURIComponent(postId)}?access_token=${encodeURIComponent(
        this.pageAccessToken
      )}`
      const res = await fetch(url, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) {
        return { success: false, error: data.error.message }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async likePost() {
    return { success: false, error: 'Liking via Graph from this app is not configured.' }
  }

  async sharePost() {
    return { success: false, error: 'Sharing via Graph from this app is not configured.' }
  }

  /**
   * Opens Facebook’s classic sharer (user-controlled). This app publishes stories via
   * POST /{page-id}/feed only — do not use this for “posting”; it is optional link sharing.
   */
  openShareDialog({ href, quote } = {}) {
    const fallbackUrl = String(import.meta.env.VITE_FACEBOOK_SHARE_FALLBACK_URL || '').trim()
    const link = String(href || fallbackUrl || '').trim()
    if (!link) {
      return { success: false, error: 'A public link is required to open the share dialog.' }
    }

    // Use the classic sharer endpoint to avoid strict App Domains requirements that
    // can block dev tunnels / localhost. This still opens a user-controlled share UI.
    const params = new URLSearchParams()
    params.set('u', link)
    if (quote) params.set('quote', String(quote).slice(0, 9000))

    const url = `https://www.facebook.com/sharer/sharer.php?${params.toString()}`

    if (typeof window !== 'undefined') {
      const w = 680
      const h = 520
      const left = Math.max(0, Math.floor(window.screenX + (window.outerWidth - w) / 2))
      const top = Math.max(0, Math.floor(window.screenY + (window.outerHeight - h) / 2))
      window.open(url, 'fb_share', `width=${w},height=${h},left=${left},top=${top}`)
    }

    return { success: true, url }
  }

  async getUserInfo() {
    if (!this.userAccessToken) return null
    try {
      const res = await fetch(
        `${this.graphBase}/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
          this.userAccessToken
        )}`
      )
      return await res.json()
    } catch {
      return null
    }
  }

  _permalinkFromPostId(postId) {
    if (!postId || typeof postId !== 'string') return null
    const parts = postId.split('_')
    if (parts.length < 2) return `https://www.facebook.com/${postId}`
    const [pageOrUserId, storyFbid] = parts
    return `https://www.facebook.com/permalink.php?story_fbid=${encodeURIComponent(
      storyFbid
    )}&id=${encodeURIComponent(pageOrUserId)}`
  }
}

export const facebookService = new FacebookService()
