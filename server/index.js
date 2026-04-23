import express from 'express'
import cookieParser from 'cookie-parser'
import crypto from 'crypto'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Always load project-root `.env` (fixes 500 when `node server/index.js` is started from another cwd).
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true })

const app = express()
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

const pageImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

app.use((req, _res, next) => {
  // Minimal request logging to debug OAuth redirects locally
  console.log(`[req] ${req.method} ${req.originalUrl}`)
  next()
})

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'social-echo-api',
    routes: {
      authLogin: '/auth/facebook/login',
      authCallback: '/auth/facebook/callback',
      me: '/api/me',
      pageTextPost: '/api/lgu/posts',
      pagePhotoPost: '/api/page/photo-post',
      debugOAuthScopes: '/api/debug/oauth-scopes'
    }
  })
})

const API_VERSION = process.env.FACEBOOK_API_VERSION || process.env.VITE_FACEBOOK_API_VERSION || 'v18.0'
const APP_ID = String(process.env.FACEBOOK_APP_ID || process.env.VITE_FACEBOOK_APP_ID || '').trim()
const APP_SECRET = String(process.env.FACEBOOK_APP_SECRET || '').trim()
const DEFAULT_SCOPES =
  process.env.FACEBOOK_LOGIN_SCOPES ||
  process.env.VITE_FACEBOOK_LOGIN_SCOPES ||
  // Page posting needs these; enable them for this app in Meta → Use cases / Permissions.
  // If Meta returns invalid_scope, set FACEBOOK_LOGIN_SCOPES in `.env` to a smaller set while testing.
  'public_profile,email,pages_show_list,pages_manage_posts'

const PORT = Number(process.env.PORT || 8001)
const FRONTEND_ORIGIN = String(process.env.FRONTEND_ORIGIN || 'http://localhost:8000').replace(/\/$/, '')
const SESSION_COOKIE = 'secho_sid'
const sessions = new Map()

// =============================================================================
// Option B: Server-only Page publishing (no Facebook login required)
// =============================================================================
// WARNING: This is for testing/demo only. Anyone who can access this API can post to the Page.
const SERVER_PAGE_ID = String(process.env.FACEBOOK_SERVER_PAGE_ID || '').trim()
const SERVER_PAGE_NAME = String(process.env.FACEBOOK_SERVER_PAGE_NAME || '').trim()
const SERVER_PAGE_ACCESS_TOKEN = String(process.env.FACEBOOK_SERVER_PAGE_ACCESS_TOKEN || '').trim()

function looksLikePlaceholderToken(token) {
  const t = String(token || '').trim()
  if (!t) return true
  // Common placeholder used in this repo's .env template.
  if (t === 'PASTE_YOUR_PAGE_ACCESS_TOKEN_HERE') return true
  // Guard against someone pasting the comment line or similar.
  if (/paste/i.test(t) && /token/i.test(t) && t.length < 60) return true
  return false
}

function serverTokenModeEnabled() {
  return Boolean(SERVER_PAGE_ID && SERVER_PAGE_ACCESS_TOKEN && !looksLikePlaceholderToken(SERVER_PAGE_ACCESS_TOKEN))
}

function requireServerPageConfig(res) {
  if (!SERVER_PAGE_ID || !SERVER_PAGE_ACCESS_TOKEN || looksLikePlaceholderToken(SERVER_PAGE_ACCESS_TOKEN)) {
    res.status(503).json({
      success: false,
      error:
        'Server Page token is not configured. Set FACEBOOK_SERVER_PAGE_ID and FACEBOOK_SERVER_PAGE_ACCESS_TOKEN in .env, then restart the API.'
    })
    return false
  }
  return true
}

async function getGrantedPermissions(accessToken) {
  const token = String(accessToken || '')
  if (!token) return { success: false, error: 'Missing access token', permissions: [] }
  try {
    const r = await fetch(`${graphBase()}/me/permissions?access_token=${encodeURIComponent(token)}`)
    const j = await r.json().catch(() => null)
    if (!r.ok || j?.error) {
      return {
        success: false,
        error: j?.error?.message || `Failed to fetch /me/permissions (${r.status})`,
        permissions: []
      }
    }
    const rows = Array.isArray(j?.data) ? j.data : []
    const granted = rows.filter((p) => p?.status === 'granted').map((p) => p.permission).filter(Boolean)
    return { success: true, permissions: granted, raw: rows }
  } catch (e) {
    return { success: false, error: e?.message || 'Network error', permissions: [] }
  }
}

function normalizeScopes(scopeString) {
  const raw = String(scopeString || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(raw)].join(',')
}

function scopeIncludesPageAccess(scopeString) {
  const s = normalizeScopes(scopeString)
  return s.includes('pages_show_list') || s.includes('pages_manage_posts')
}

/** Page posting needs these; set FACEBOOK_SKIP_PAGE_SCOPES=1 only if Meta rejects them during testing. */
function ensurePagePublishingScopes(scopeString) {
  if (process.env.FACEBOOK_SKIP_PAGE_SCOPES === '1') {
    return normalizeScopes(scopeString) || 'public_profile'
  }
  if (scopeIncludesPageAccess(scopeString)) {
    return normalizeScopes(scopeString) || 'public_profile'
  }
  const base = normalizeScopes(scopeString) || 'public_profile,email'
  return (
    normalizeScopes(`${base},pages_show_list,pages_manage_posts,pages_read_engagement`) || base
  )
}

function getOrigin(req) {
  const xfProto = req.header('x-forwarded-proto')
  const xfHost = req.header('x-forwarded-host')
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`
  return `${req.protocol}://${req.get('host')}`
}

function graphBase() {
  return `https://graph.facebook.com/${API_VERSION}`
}

function buildFacebookPermalinkFromPostId(postId) {
  if (!postId) return null
  const id = String(postId)
  if (id.includes('_')) {
    const [pageOrUserId, storyFbid] = id.split('_')
    if (!pageOrUserId || !storyFbid) return null
    return `https://www.facebook.com/permalink.php?story_fbid=${encodeURIComponent(
      storyFbid
    )}&id=${encodeURIComponent(pageOrUserId)}`
  }
  return `https://www.facebook.com/${encodeURIComponent(id)}`
}

async function getPostPermalinkUrl({ postId, accessToken }) {
  if (!postId) return null
  const token = String(accessToken || '')
  if (!token) return null

  const fields = 'permalink_url'
  const url = `${graphBase()}/${encodeURIComponent(postId)}?fields=${encodeURIComponent(
    fields
  )}&access_token=${encodeURIComponent(token)}`
  const r = await fetch(url)
  const j = await r.json().catch(() => null)
  if (!r.ok || j?.error) return null
  return j?.permalink_url || null
}

/** Publish to a Facebook Page only (POST /{page-id}/feed + Page access token). Never use for /me/feed or personal profile. */
async function createPageFeedPost({ pageId, pageAccessToken, message, link, picture, published }) {
  const params = new URLSearchParams()
  params.set('access_token', pageAccessToken)
  if (message) params.set('message', message)
  if (link) params.set('link', link)
  if (picture) params.set('picture', picture)
  params.set('published', published ? 'true' : 'false')

  const r = await fetch(`${graphBase()}/${encodeURIComponent(pageId)}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })
  const j = await r.json().catch(() => null)
  return { ok: r.ok && !j?.error, status: r.status, data: j }
}

function getRedirectUri() {
  // We always use the frontend origin since `/auth/*` is proxied to this server in dev,
  // and in prod you typically register the public site URL in Meta's Valid OAuth Redirect URIs.
  return `${FRONTEND_ORIGIN}/auth/facebook/callback`
}

function requireSession(req) {
  const sid = req.cookies?.[SESSION_COOKIE]
  if (!sid) return null
  const s = sessions.get(sid)
  if (!s) return null
  return { sid, ...s }
}

function requireAuth(req, res) {
  const s = requireSession(req)
  if (!s) {
    res.status(401).json({ success: false, error: 'Not signed in' })
    return null
  }
  return s
}

function findManagedPage(session, pageId) {
  if (!pageId) return null
  const pages = Array.isArray(session?.pages) ? session.pages : []
  return pages.find((p) => String(p.id) === String(pageId)) || null
}

/** If set, must match a Page in the user session (numeric Page id from Meta). */
const LGU_PAGE_ID_ENV = String(process.env.FACEBOOK_LGU_PAGE_ID || process.env.VITE_LGU_FACEBOOK_PAGE_ID || '').trim()
/** If set, must match a Page in the user session (Page name; case-insensitive). */
const LGU_PAGE_NAME_ENV = String(process.env.FACEBOOK_LGU_PAGE_NAME || '').trim()

/**
 * Resolves the single “LGU” Facebook Page for the web app: env id wins, else first Page whose name
 * matches env name (case-insensitive), else first Page whose name contains the word “LGU”
 * (word-boundary / case-insensitive).
 */
function resolveLguPageFromSessionPages(pages) {
  const list = Array.isArray(pages) ? pages : []
  if (LGU_PAGE_ID_ENV) {
    const p = list.find((x) => String(x.id) === LGU_PAGE_ID_ENV)
    return p || null
  }
  if (LGU_PAGE_NAME_ENV) {
    const wanted = LGU_PAGE_NAME_ENV.trim().toLowerCase()
    const p = list.find((x) => String(x?.name || '').trim().toLowerCase() === wanted)
    return p || null
  }
  return list.find((p) => /\blgu\b/i.test(String(p.name || ''))) || null
}

function assertRequestTargetsLguPage(session, pageId) {
  const lgu = resolveLguPageFromSessionPages(session?.pages)
  if (!lgu?.id) {
    return {
      ok: false,
      error:
        'Target Facebook Page not found for this account. Set FACEBOOK_LGU_PAGE_ID (numeric id) or FACEBOOK_LGU_PAGE_NAME (exact Page name) in .env, or name the Page to include the word "LGU", then log in again.'
    }
  }
  if (String(pageId) !== String(lgu.id)) {
    return { ok: false, error: 'This app only publishes to the LGU Facebook Page.' }
  }
  return { ok: true, lgu }
}

function sendFacebookLoginConfigError(res, detail) {
  const safe = String(detail || 'Configuration error').replace(/</g, '&lt;')
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Facebook login — setup required</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 4px; }
    pre { background: #111827; color: #f9fafb; padding: 1rem; border-radius: 8px; overflow: auto; }
  </style>
</head>
<body>
  <h1>Facebook login cannot start</h1>
  <p>The API needs a Meta app ID and <strong>App Secret</strong> in the project root <code>.env</code> file.</p>
  <pre>${safe}</pre>
  <p>Add for example:</p>
  <pre>FACEBOOK_APP_ID=…your numeric app id…
FACEBOOK_APP_SECRET=…from Meta App Dashboard → Settings → Basic…
# or use VITE_FACEBOOK_APP_ID for the app id (same value)</pre>
  <p>Then restart the API: <code>npm run dev:server</code> (must match the port Vite proxies to, e.g. <code>PORT=8001</code>).</p>
</body>
</html>`
  res.status(503).type('html').send(html)
}

app.get('/auth/facebook/login', (req, res) => {
  if (!APP_ID) {
    console.error('[auth] Missing FACEBOOK_APP_ID / VITE_FACEBOOK_APP_ID (loaded .env from', path.join(__dirname, '..', '.env'), ')')
    return sendFacebookLoginConfigError(res, 'Missing FACEBOOK_APP_ID or VITE_FACEBOOK_APP_ID.')
  }
  if (!APP_SECRET) {
    console.error('[auth] Missing FACEBOOK_APP_SECRET (server-only; never expose in frontend)')
    return sendFacebookLoginConfigError(res, 'Missing FACEBOOK_APP_SECRET.')
  }

  const redirectUri = getRedirectUri()
  const state = crypto.randomBytes(16).toString('hex')
  let requestedScopes = normalizeScopes(req.query.scopes || DEFAULT_SCOPES) || 'public_profile'
  // Old fb_retry used ?scopes=public_profile only — that blocks Page listing. If .env default includes
  // Page scopes, never allow a narrow ?scopes= query to override them.
  if (scopeIncludesPageAccess(DEFAULT_SCOPES) && !scopeIncludesPageAccess(requestedScopes)) {
    console.warn('[auth] OAuth scope query missing Page access; using FACEBOOK_LOGIN_SCOPES / server default.')
    requestedScopes = normalizeScopes(DEFAULT_SCOPES) || 'public_profile'
  }
  requestedScopes = ensurePagePublishingScopes(requestedScopes)
  console.log('[auth] OAuth final scope param:', requestedScopes)

  res.cookie('fb_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  })
  // Persist requested scopes so the callback can surface helpful diagnostics.
  res.cookie('fb_oauth_scopes', requestedScopes, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  })

  const params = new URLSearchParams()
  params.set('client_id', APP_ID)
  params.set('redirect_uri', redirectUri)
  params.set('state', state)
  params.set('scope', requestedScopes)
  params.set('response_type', 'code')
  // Ask Facebook to show the dialog again for permissions the user skipped (e.g. Pages).
  if (String(req.query.auth_type || '') === 'rerequest') {
    params.set('auth_type', 'rerequest')
  }

  res.redirect(`https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`)
})

app.get('/auth/facebook/callback', async (req, res) => {
  const code = String(req.query.code || '')
  const state = String(req.query.state || '')
  const storedState = String(req.cookies?.fb_oauth_state || '')
  const error = req.query.error ? String(req.query.error) : null
  const errorDescription = req.query.error_description ? String(req.query.error_description) : null
  const errorReason = req.query.error_reason ? String(req.query.error_reason) : null
  // Facebook sometimes returns error_code/error_message instead of error/error_description
  const errorCode = req.query.error_code ? String(req.query.error_code) : null
  const errorMessage = req.query.error_message ? String(req.query.error_message) : null

  console.log('[oauth] callback query keys:', Object.keys(req.query || {}))

  if (error || errorCode) {
    const msg = [errorDescription, errorReason, errorMessage, error, errorCode]
      .filter(Boolean)
      .join(' — ')

    const looksLikeInvalidScopes =
      error === 'invalid_scope' ||
      (errorMessage && /invalid\s+scopes?/i.test(errorMessage)) ||
      (msg && /invalid\s+scopes?/i.test(msg))

    // When scopes are rejected, allow an easy retry with a minimal known-good set.
    if (looksLikeInvalidScopes) {
      return res.redirect(
        `${FRONTEND_ORIGIN}/?fb_error=${encodeURIComponent(
          msg || 'Invalid scopes requested.'
        )}&fb_retry=${encodeURIComponent('/auth/facebook/login?auth_type=rerequest')}`
      )
    }

    return res.redirect(`${FRONTEND_ORIGIN}/?fb_error=${encodeURIComponent(msg || error || errorCode)}`)
  }
  if (!code) {
    return res.redirect(
      `${FRONTEND_ORIGIN}/?fb_error=${encodeURIComponent(
        'Missing code (Facebook did not return an authorization code — check your Valid OAuth Redirect URIs and start login from the app button).'
      )}`
    )
  }
  if (!state || !storedState || state !== storedState) {
    return res.redirect(`${FRONTEND_ORIGIN}/?fb_error=Invalid%20state`)
  }

  try {
    const redirectUri = getRedirectUri()

    const tokenParams = new URLSearchParams()
    tokenParams.set('client_id', APP_ID)
    tokenParams.set('redirect_uri', redirectUri)
    tokenParams.set('client_secret', APP_SECRET)
    tokenParams.set('code', code)

    const tokenRes = await fetch(`${graphBase()}/oauth/access_token?${tokenParams.toString()}`)
    const tokenJson = await tokenRes.json()
    if (tokenJson?.error) {
      return res.redirect(
        `${FRONTEND_ORIGIN}/?fb_error=${encodeURIComponent(
          tokenJson.error.message || 'Token exchange failed'
        )}`
      )
    }

    const accessToken = tokenJson.access_token
    if (!accessToken) return res.redirect('/?fb_error=No%20access%20token')

    const meRes = await fetch(
      `${graphBase()}/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`
    )
    const me = await meRes.json()
    if (me?.error) {
      return res.redirect(
        `${FRONTEND_ORIGIN}/?fb_error=${encodeURIComponent(me.error.message || 'Failed to fetch profile')}`
      )
    }

    const requestedScopes = String(req.cookies?.fb_oauth_scopes || '').trim()
    const permRes = await getGrantedPermissions(accessToken)

    const pagesRes = await fetch(
      `${graphBase()}/me/accounts?fields=id,name,access_token,category&access_token=${encodeURIComponent(accessToken)}`
    )
    const pagesJson = await pagesRes.json()
    if (pagesJson?.error) {
      return res.redirect(
        `${FRONTEND_ORIGIN}/?fb_error=${encodeURIComponent(
          pagesJson.error.message ||
            'Could not load Facebook Pages. Ensure you manage at least one Page and the app has pages_show_list/pages_manage_posts permissions enabled.'
        )}`
      )
    }
    const pages = Array.isArray(pagesJson?.data) ? pagesJson.data : []
    if (pages.length === 0) {
      console.warn('[oauth] /me/accounts returned 0 pages. requestedScopes=', requestedScopes, 'granted=', permRes.success ? permRes.permissions : permRes.error)
    }

    const sid = crypto.randomBytes(18).toString('hex')
    sessions.set(sid, {
      createdAt: Date.now(),
      accessToken,
      user: me,
      pages,
      auth: {
        requestedScopes,
        grantedPermissions: permRes.success ? permRes.permissions : [],
        permissionsDetail: permRes.success ? permRes.raw : [],
        permissionsError: permRes.success ? null : permRes.error
      }
    })

    res.clearCookie('fb_oauth_state')
    res.clearCookie('fb_oauth_scopes')
    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    })

    res.redirect(`${FRONTEND_ORIGIN}/?fb=1`)
  } catch (e) {
    console.error('[oauth] callback failed:', e)
    const cause = e?.cause
    const causeBits = []
    if (cause?.code) causeBits.push(`code=${cause.code}`)
    if (cause?.errno) causeBits.push(`errno=${cause.errno}`)
    if (cause?.syscall) causeBits.push(`syscall=${cause.syscall}`)
    const causeSuffix = causeBits.length ? ` (${causeBits.join(', ')})` : ''

    const msg =
      (e?.message ? String(e.message) : '') ||
      'OAuth callback failed'

    // “fetch failed” here almost always means Node could not reach https://graph.facebook.com
    // (network blocked, DNS, firewall, antivirus HTTPS interception, or offline).
    const hint =
      /fetch failed/i.test(msg) || /ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(`${cause?.code || ''}`)
        ? 'Server could not reach graph.facebook.com. Check internet, firewall/antivirus, VPN/proxy, or allow Meta Graph API.'
        : ''

    const full = [msg + causeSuffix, hint].filter(Boolean).join(' — ')
    res.redirect(`${FRONTEND_ORIGIN}/?fb_error=${encodeURIComponent(full || 'OAuth callback failed')}`)
  }
})

app.post('/auth/logout', (req, res) => {
  const sid = req.cookies?.[SESSION_COOKIE]
  if (sid) sessions.delete(sid)
  res.clearCookie(SESSION_COOKIE)
  res.json({ success: true })
})

/** No secrets — use to verify the API process loaded `.env` and will add Page scopes on login. */
app.get('/api/debug/oauth-scopes', (_req, res) => {
  res.json({
    DEFAULT_SCOPES,
    defaultIncludesPageAccess: scopeIncludesPageAccess(DEFAULT_SCOPES),
    FACEBOOK_LOGIN_SCOPES_env_set: Boolean(process.env.FACEBOOK_LOGIN_SCOPES),
    FACEBOOK_SKIP_PAGE_SCOPES: process.env.FACEBOOK_SKIP_PAGE_SCOPES === '1',
    exampleMergedFromBasicOnly: ensurePagePublishingScopes('public_profile,email')
  })
})

/** Debug: verify the API server can reach Meta Graph from this machine/network. */
app.get('/api/debug/graph', async (_req, res) => {
  try {
    const r = await fetch(`${graphBase()}/platform/version`)
    const j = await r.json().catch(() => null)
    if (!r.ok || j?.error) {
      return res.status(502).json({
        success: false,
        error: j?.error?.message || `Graph responded with HTTP ${r.status}`,
        details: j?.error || j
      })
    }
    return res.json({ success: true, graph: j })
  } catch (e) {
    const cause = e?.cause
    return res.status(502).json({
      success: false,
      error: e?.message || 'Failed to reach graph.facebook.com',
      cause: cause
        ? {
            code: cause.code || null,
            errno: cause.errno || null,
            syscall: cause.syscall || null
          }
        : null
    })
  }
})

app.get('/api/me', async (req, res) => {
  const s = requireSession(req)
  if (!s) return res.status(401).json({ success: false, error: 'Not signed in' })

  const lgu = resolveLguPageFromSessionPages(s.pages)
  res.json({
    success: true,
    user: {
      id: s.user.id,
      name: s.user.name,
      email: s.user.email || '',
      picture: s.user.picture?.data?.url || '',
      accessToken: s.accessToken,
      pages: (s.pages || []).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        access_token: p.access_token
      })),
      lguPage: lgu
        ? { id: lgu.id, name: lgu.name, category: lgu.category || null }
        : null,
      selectedPageId: lgu?.id ?? null,
      pageAccessToken: lgu?.access_token || null,
      authentication: s.auth || null
    }
  })
})

/**
 * Public config for the frontend. No secrets returned.
 * Lets the UI know whether server-token publishing is available (Option B).
 */
app.get('/api/config', (_req, res) => {
  if (serverTokenModeEnabled()) {
    return res.json({
      success: true,
      publishingMode: 'server_token',
      targetPage: {
        id: SERVER_PAGE_ID,
        name: SERVER_PAGE_NAME || null
      }
    })
  }
  return res.json({
    success: true,
    publishingMode: 'oauth',
    targetPage: null
  })
})

/**
 * Option B: Publish a text/link post to the configured Page using the server token.
 * Body: { message, link?, picture?, published? }
 */
app.post('/api/server/page/post', async (req, res) => {
  if (!requireServerPageConfig(res)) return
  const message = String(req.body?.message || '').trim()
  const link = req.body?.link ? String(req.body.link).trim() : ''
  const picture = req.body?.picture ? String(req.body.picture).trim() : ''
  const published = req.body?.published === false ? false : true

  if (!message && !link && !picture) {
    return res.status(400).json({ success: false, error: 'Add a message, link, or picture URL.' })
  }

  try {
    const postRes = await createPageFeedPost({
      pageId: SERVER_PAGE_ID,
      pageAccessToken: SERVER_PAGE_ACCESS_TOKEN,
      message,
      link,
      picture,
      published
    })
    const data = postRes.data
    if (!postRes.ok) {
      return res.status(400).json({
        success: false,
        error: data?.error?.message || `Facebook feed post failed (${postRes.status}).`,
        details: data?.error || data
      })
    }
    const postId = data.id || null
    const facebookUrl = buildFacebookPermalinkFromPostId(postId)
    return res.json({
      success: true,
      postId,
      facebookUrl,
      target: { pageId: SERVER_PAGE_ID, pageName: SERVER_PAGE_NAME || null }
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to publish to server Page.' })
  }
})

/**
 * Option B: Publish a photo post (multipart) to the configured Page using the server token.
 * Form fields: message?, file field: image
 */
app.post('/api/server/page/photo-post', pageImageUpload.single('image'), async (req, res) => {
  if (!requireServerPageConfig(res)) return
  const message = String(req.body?.message || '').trim()
  const file = req.file
  if (!file?.buffer) return res.status(400).json({ success: false, error: 'Missing image file.' })

  try {
    const form = new FormData()
    form.append('access_token', SERVER_PAGE_ACCESS_TOKEN)
    if (message) form.append('message', message)
    form.append('published', 'true')
    const blob = new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' })
    form.append('source', blob, file.originalname || 'photo.jpg')

    const url = `${graphBase()}/${encodeURIComponent(SERVER_PAGE_ID)}/photos`
    const r = await fetch(url, { method: 'POST', body: form })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || data.error) {
      return res.status(400).json({
        success: false,
        error: data.error?.message || `Facebook photo post failed (${r.status}).`,
        details: data.error || data
      })
    }

    const postId = data.post_id || data.id || null
    const facebookUrl = buildFacebookPermalinkFromPostId(postId)

    return res.json({
      success: true,
      postId,
      facebookUrl,
      target: { pageId: SERVER_PAGE_ID, pageName: SERVER_PAGE_NAME || null }
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to publish photo to server Page.' })
  }
})

/**
 * Publish flow (requested):
 * Web app post -> post to Office Page -> optionally share Office post to LGU Page.
 *
 * Body:
 * - officePageId (required)
 * - message (required unless link/picture provided)
 * - lguPageId (optional; when provided, share the Office permalink to this Page)
 * - published (default true)
 */
app.post('/api/publish', async (req, res) => {
  const s = requireAuth(req, res)
  if (!s) return

  const officePageId = String(req.body?.officePageId || '')
  const lguPageId = req.body?.lguPageId ? String(req.body.lguPageId) : ''
  const message = String(req.body?.message || '').trim()
  const link = req.body?.link ? String(req.body.link).trim() : ''
  const picture = req.body?.picture ? String(req.body.picture).trim() : ''
  const published = req.body?.published === false ? false : true

  if (!officePageId) return res.status(400).json({ success: false, error: 'Missing officePageId (Office Page).' })
  if (lguPageId && String(lguPageId) === String(officePageId)) {
    return res.status(400).json({ success: false, error: 'Office Page and LGU Page must be different.' })
  }
  if (!message && !link && !picture) {
    return res.status(400).json({ success: false, error: 'Add a message, link, or picture URL.' })
  }

  const officePage = findManagedPage(s, officePageId)
  if (!officePage?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'Office Page access token not found. Please re-login and select an Office Page you manage.'
    })
  }

  const lguPage = lguPageId ? findManagedPage(s, lguPageId) : null
  if (lguPageId && !lguPage?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'LGU Page access token not found. Please re-login and select an LGU Page you manage.'
    })
  }

  try {
    // 1) Create Office Page post
    const officePostRes = await createPageFeedPost({
      pageId: officePageId,
      pageAccessToken: officePage.access_token,
      message,
      link,
      picture,
      published
    })
    const officeData = officePostRes.data
    if (!officePostRes.ok) {
      return res.status(400).json({
        success: false,
        error: officeData?.error?.message || `Facebook Office feed post failed (${officePostRes.status}).`,
        details: officeData?.error || officeData
      })
    }

    const officePostId = officeData?.id || null
    const officeFallbackUrl = buildFacebookPermalinkFromPostId(officePostId)
    const officePermalinkUrl =
      (await getPostPermalinkUrl({ postId: officePostId, accessToken: officePage.access_token })) || officeFallbackUrl

    const responsePayload = {
      success: true,
      office: {
        pageId: officePageId,
        pageName: officePage.name || null,
        postId: officePostId,
        permalinkUrl: officePermalinkUrl || null
      },
      lgu: null
    }

    // 2) Optional: "share" by posting the Office permalink as a link post on LGU Page
    if (lguPageId) {
      if (!officePermalinkUrl) {
        return res.status(400).json({
          success: false,
          error: 'Created Office post, but could not resolve its permalink URL (required to share to LGU).',
          officePostId
        })
      }

      const lguPostRes = await createPageFeedPost({
        pageId: lguPageId,
        pageAccessToken: lguPage.access_token,
        message: '',
        link: officePermalinkUrl,
        picture: '',
        published
      })
      const lguData = lguPostRes.data
      if (!lguPostRes.ok) {
        return res.status(400).json({
          success: false,
          error: lguData?.error?.message || `Facebook LGU feed post failed (${lguPostRes.status}).`,
          details: lguData?.error || lguData,
          officePostId,
          officePermalinkUrl
        })
      }

      const lguPostId = lguData?.id || null
      const lguFacebookUrl = buildFacebookPermalinkFromPostId(lguPostId)
      responsePayload.lgu = {
        pageId: lguPageId,
        pageName: lguPage.name || null,
        postId: lguPostId,
        facebookUrl: lguFacebookUrl
      }
    }

    return res.json(responsePayload)
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to publish.' })
  }
})

/**
 * Web app: post a photo to a Facebook Page using the logged-in user's session
 * (same tokens as /me/accounts at login). Body: multipart form fields `pageId`, optional `message`, file `image`.
 */
app.post('/api/page/photo-post', pageImageUpload.single('image'), async (req, res) => {
  const s = requireAuth(req, res)
  if (!s) return

  const pageId = String(req.body?.pageId || '')
  const message = String(req.body?.message || '').trim()
  const file = req.file

  if (!pageId) return res.status(400).json({ success: false, error: 'Missing pageId.' })
  if (!file?.buffer) return res.status(400).json({ success: false, error: 'Missing image file.' })

  const lguCheck = assertRequestTargetsLguPage(s, pageId)
  if (!lguCheck.ok) {
    return res.status(400).json({ success: false, error: lguCheck.error })
  }

  const page = findManagedPage(s, pageId)
  if (!page?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'Page access token not found. Re-login and pick a Page you manage.'
    })
  }

  try {
    const form = new FormData()
    form.append('access_token', page.access_token)
    if (message) form.append('message', message)
    form.append('published', 'true')
    const blob = new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' })
    form.append('source', blob, file.originalname || 'photo.jpg')

    const url = `${graphBase()}/${encodeURIComponent(pageId)}/photos`
    const r = await fetch(url, { method: 'POST', body: form })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || data.error) {
      return res.status(400).json({
        success: false,
        error: data.error?.message || `Facebook photo post failed (${r.status}).`,
        details: data.error || data
      })
    }

    const postId = data.post_id || data.id || null
    const facebookUrl = buildFacebookPermalinkFromPostId(postId)

    return res.json({
      success: true,
      postId,
      facebookUrl,
      target: { pageId, pageName: page.name || null }
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to publish photo.' })
  }
})

/**
 * Scenario 1 — Web app post -> API posts to LGU Page.
 *
 * The frontend sends { pageId, message, link, picture, published }.
 * This server looks up the Page access token from the authenticated session.
 */
app.post('/api/lgu/posts', async (req, res) => {
  const s = requireAuth(req, res)
  if (!s) return

  const pageId = String(req.body?.pageId || '')
  const message = String(req.body?.message || '').trim()
  const link = req.body?.link ? String(req.body.link).trim() : ''
  const picture = req.body?.picture ? String(req.body.picture).trim() : ''
  const published = req.body?.published === false ? false : true

  if (!pageId) return res.status(400).json({ success: false, error: 'Missing pageId (LGU Page).' })
  if (!message && !link && !picture) {
    return res.status(400).json({ success: false, error: 'Add a message, link, or picture URL.' })
  }

  const lguCheck = assertRequestTargetsLguPage(s, pageId)
  if (!lguCheck.ok) {
    return res.status(400).json({ success: false, error: lguCheck.error })
  }

  const page = findManagedPage(s, pageId)
  if (!page?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'LGU Page access token not found. Please re-login and select an LGU Page you manage.'
    })
  }

  try {
    const postRes = await createPageFeedPost({
      pageId,
      pageAccessToken: page.access_token,
      message,
      link,
      picture,
      published
    })
    const data = postRes.data
    if (!postRes.ok) {
      return res.status(400).json({
        success: false,
        error: data?.error?.message || `Facebook feed post failed (${postRes.status}).`,
        details: data?.error || data
      })
    }

    const postId = data.id || null
    const facebookUrl = buildFacebookPermalinkFromPostId(postId)

    return res.json({
      success: true,
      postId,
      facebookUrl,
      target: { pageId, pageName: page.name || null }
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to publish to LGU Page.' })
  }
})

/**
 * Scenario 2 — Office Page -> (optional) share to LGU Page.
 *
 * This flow is split into 2 steps for UX:
 * 1) Create a post on the Office Page and return its permalink URL.
 * 2) Share that permalink URL to the LGU Page (post a link).
 *
 * The combined legacy endpoint `/api/scenario2/share` remains for compatibility.
 */

app.post('/api/scenario2/office-post', async (req, res) => {
  const s = requireAuth(req, res)
  if (!s) return

  const officePageId = String(req.body?.officePageId || '')
  const message = String(req.body?.message || '').trim()
  const link = req.body?.link ? String(req.body.link).trim() : ''
  const picture = req.body?.picture ? String(req.body.picture).trim() : ''
  const published = req.body?.published === false ? false : true

  if (!officePageId) return res.status(400).json({ success: false, error: 'Missing officePageId (Office Page).' })
  if (!message && !link && !picture) {
    return res.status(400).json({ success: false, error: 'Add a message, link, or picture URL.' })
  }

  const officePage = findManagedPage(s, officePageId)
  if (!officePage?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'Office Page access token not found. Please re-login and select an Office Page you manage.'
    })
  }

  try {
    const officePostRes = await createPageFeedPost({
      pageId: officePageId,
      pageAccessToken: officePage.access_token,
      message,
      link,
      picture,
      published
    })
    const officeData = officePostRes.data
    if (!officePostRes.ok) {
      return res.status(400).json({
        success: false,
        error: officeData?.error?.message || `Facebook Office feed post failed (${officePostRes.status}).`,
        details: officeData?.error || officeData
      })
    }

    const officePostId = officeData?.id || null
    const officeFallbackUrl = buildFacebookPermalinkFromPostId(officePostId)
    const officePermalinkUrl =
      (await getPostPermalinkUrl({ postId: officePostId, accessToken: officePage.access_token })) || officeFallbackUrl

    return res.json({
      success: true,
      office: {
        pageId: officePageId,
        pageName: officePage.name || null,
        postId: officePostId,
        permalinkUrl: officePermalinkUrl || null
      }
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to create Office post.' })
  }
})

app.post('/api/scenario2/share-existing', async (req, res) => {
  const s = requireAuth(req, res)
  if (!s) return

  const lguPageId = String(req.body?.lguPageId || '')
  const officePermalinkUrl = String(req.body?.officePermalinkUrl || '').trim()
  const message = String(req.body?.message || '').trim()
  const published = req.body?.published === false ? false : true

  if (!lguPageId) return res.status(400).json({ success: false, error: 'Missing lguPageId (LGU Page).' })
  if (!officePermalinkUrl) {
    return res.status(400).json({ success: false, error: 'Missing officePermalinkUrl (Office post link).' })
  }

  const lguPage = findManagedPage(s, lguPageId)
  if (!lguPage?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'LGU Page access token not found. Please re-login and select an LGU Page you manage.'
    })
  }

  try {
    const lguPostRes = await createPageFeedPost({
      pageId: lguPageId,
      pageAccessToken: lguPage.access_token,
      message: message || '',
      link: officePermalinkUrl,
      picture: '',
      published
    })
    const lguData = lguPostRes.data
    if (!lguPostRes.ok) {
      return res.status(400).json({
        success: false,
        error: lguData?.error?.message || `Facebook LGU feed post failed (${lguPostRes.status}).`,
        details: lguData?.error || lguData,
        officePermalinkUrl
      })
    }

    const lguPostId = lguData?.id || null
    const lguFacebookUrl = buildFacebookPermalinkFromPostId(lguPostId)

    return res.json({
      success: true,
      lgu: {
        pageId: lguPageId,
        pageName: lguPage.name || null,
        postId: lguPostId,
        facebookUrl: lguFacebookUrl
      }
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to share Office post to LGU Page.' })
  }
})

/**
 * Legacy combined endpoint (create Office post then share to LGU).
 *
 * The frontend sends { officePageId, lguPageId, message, link, picture, published }.
 */
app.post('/api/scenario2/share', async (req, res) => {
  const s = requireAuth(req, res)
  if (!s) return

  const officePageId = String(req.body?.officePageId || '')
  const lguPageId = String(req.body?.lguPageId || '')
  const message = String(req.body?.message || '').trim()
  const link = req.body?.link ? String(req.body.link).trim() : ''
  const picture = req.body?.picture ? String(req.body.picture).trim() : ''
  const published = req.body?.published === false ? false : true

  if (!officePageId) return res.status(400).json({ success: false, error: 'Missing officePageId (Office Page).' })
  if (!lguPageId) return res.status(400).json({ success: false, error: 'Missing lguPageId (LGU Page).' })
  if (String(officePageId) === String(lguPageId)) {
    return res.status(400).json({ success: false, error: 'Office Page and LGU Page must be different.' })
  }
  if (!message && !link && !picture) {
    return res.status(400).json({ success: false, error: 'Add a message, link, or picture URL.' })
  }

  const officePage = findManagedPage(s, officePageId)
  if (!officePage?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'Office Page access token not found. Please re-login and select an Office Page you manage.'
    })
  }

  const lguPage = findManagedPage(s, lguPageId)
  if (!lguPage?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'LGU Page access token not found. Please re-login and select an LGU Page you manage.'
    })
  }

  try {
    // 1) Create Office Page post
    const officePostRes = await createPageFeedPost({
      pageId: officePageId,
      pageAccessToken: officePage.access_token,
      message,
      link,
      picture,
      published
    })
    const officeData = officePostRes.data
    if (!officePostRes.ok) {
      return res.status(400).json({
        success: false,
        error: officeData?.error?.message || `Facebook Office feed post failed (${officePostRes.status}).`,
        details: officeData?.error || officeData
      })
    }

    const officePostId = officeData.id || null
    const officeFallbackUrl = buildFacebookPermalinkFromPostId(officePostId)
    const officePermalinkUrl =
      (await getPostPermalinkUrl({ postId: officePostId, accessToken: officePage.access_token })) ||
      officeFallbackUrl

    if (!officePermalinkUrl) {
      return res.status(400).json({
        success: false,
        error: 'Created Office post, but could not resolve its permalink URL.'
      })
    }

    // 3) Create LGU Page post pointing to Office permalink
    const lguPostRes = await createPageFeedPost({
      pageId: lguPageId,
      pageAccessToken: lguPage.access_token,
      message,
      link: officePermalinkUrl,
      picture: '',
      published
    })
    const lguData = lguPostRes.data
    if (!lguPostRes.ok) {
      return res.status(400).json({
        success: false,
        error: lguData?.error?.message || `Facebook LGU feed post failed (${lguPostRes.status}).`,
        details: lguData?.error || lguData,
        officePostId,
        officePermalinkUrl
      })
    }

    const lguPostId = lguData.id || null
    const lguFacebookUrl = buildFacebookPermalinkFromPostId(lguPostId)

    return res.json({
      success: true,
      office: {
        pageId: officePageId,
        pageName: officePage.name || null,
        postId: officePostId,
        permalinkUrl: officePermalinkUrl
      },
      lgu: {
        pageId: lguPageId,
        pageName: lguPage.name || null,
        postId: lguPostId,
        facebookUrl: lguFacebookUrl
      }
    })
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to run Scenario 2.' })
  }
})

/**
 * Reads latest posts from the chosen LGU Page (via server-side token).
 * Query: /api/lgu/feed?pageId=<lguPageId>&limit=10
 */
app.get('/api/lgu/feed', async (req, res) => {
  const s = requireAuth(req, res)
  if (!s) return

  const lgu = resolveLguPageFromSessionPages(s.pages)
  if (!lgu?.id) {
    return res.status(400).json({
      success: false,
      error:
        'LGU Facebook Page not found. Set FACEBOOK_LGU_PAGE_ID in .env or use a Page name that includes "LGU", then sign in again.'
    })
  }

  const pageId = String(req.query?.pageId || lgu.id)
  const limit = Math.max(1, Math.min(25, Number(req.query?.limit || 10)))

  if (String(pageId) !== String(lgu.id)) {
    return res.status(400).json({ success: false, error: 'This feed is only for the LGU Facebook Page.' })
  }

  const page = findManagedPage(s, pageId)
  if (!page?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'LGU Page access token not found. Please re-login and select an LGU Page you manage.'
    })
  }

  try {
    const fields = 'id,message,created_time,permalink_url'
    const url = `${graphBase()}/${encodeURIComponent(pageId)}/feed?fields=${encodeURIComponent(
      fields
    )}&limit=${limit}&access_token=${encodeURIComponent(page.access_token)}`
    const feedRes = await fetch(url)
    const data = await feedRes.json()
    if (!feedRes.ok || data?.error) {
      return res.status(400).json({
        success: false,
        error: data?.error?.message || `Facebook feed fetch failed (${feedRes.status}).`,
        details: data?.error || data
      })
    }

    const items = Array.isArray(data?.data) ? data.data : []
    const posts = items.map((p) => ({
      id: p.id,
      content: p.message || '',
      createdAt: p.created_time || new Date().toISOString(),
      facebookUrl: p.permalink_url || null
    }))

    return res.json({ success: true, posts })
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch LGU feed.' })
  }
})

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  console.log('[server] DEFAULT_SCOPES:', DEFAULT_SCOPES)
  if (LGU_PAGE_ID_ENV) console.log('[server] FACEBOOK_LGU_PAGE_ID (locked target Page):', LGU_PAGE_ID_ENV)
  else if (LGU_PAGE_NAME_ENV) console.log('[server] FACEBOOK_LGU_PAGE_NAME (locked target Page):', LGU_PAGE_NAME_ENV)
  else console.log('[server] Target Page: resolve by Page name containing word "LGU" (or set FACEBOOK_LGU_PAGE_ID / FACEBOOK_LGU_PAGE_NAME in .env)')
  if (process.env.FACEBOOK_SKIP_PAGE_SCOPES === '1') {
    console.warn('[server] FACEBOOK_SKIP_PAGE_SCOPES=1 — Page scopes will NOT be auto-added on login.')
  }
  if (!APP_ID || !APP_SECRET) {
    console.warn(
      '[server] Facebook OAuth is not configured (missing APP_ID or FACEBOOK_APP_SECRET). /auth/facebook/login will return 503 until .env is set.'
    )
  } else {
    console.log('[server] Facebook OAuth: APP_ID loaded, FACEBOOK_APP_SECRET loaded')
  }
})

