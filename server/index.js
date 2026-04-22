import express from 'express'
import cookieParser from 'cookie-parser'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

app.use((req, _res, next) => {
  // Minimal request logging to debug OAuth redirects locally
  console.log(`[req] ${req.method} ${req.originalUrl}`)
  next()
})

const API_VERSION = process.env.FACEBOOK_API_VERSION || process.env.VITE_FACEBOOK_API_VERSION || 'v18.0'
const APP_ID = process.env.FACEBOOK_APP_ID || process.env.VITE_FACEBOOK_APP_ID
const APP_SECRET = process.env.FACEBOOK_APP_SECRET
const DEFAULT_SCOPES =
  process.env.FACEBOOK_LOGIN_SCOPES ||
  process.env.VITE_FACEBOOK_LOGIN_SCOPES ||
  // Safe default: some apps may even have `email` disabled until configured in Meta console.
  // Start with the minimal scope and opt-in via FACEBOOK_LOGIN_SCOPES when ready.
  'public_profile'

const PORT = Number(process.env.PORT || 8001)
const FRONTEND_ORIGIN = String(process.env.FRONTEND_ORIGIN || 'http://localhost:8000').replace(/\/$/, '')
const SESSION_COOKIE = 'secho_sid'
const sessions = new Map()

function normalizeScopes(scopeString) {
  const raw = String(scopeString || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(raw)].join(',')
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

app.get('/auth/facebook/login', (req, res) => {
  if (!APP_ID) return res.status(500).send('Missing FACEBOOK_APP_ID / VITE_FACEBOOK_APP_ID in .env')
  if (!APP_SECRET) return res.status(500).send('Missing FACEBOOK_APP_SECRET in .env (server-side secret)')

  const redirectUri = getRedirectUri()
  const state = crypto.randomBytes(16).toString('hex')
  const requestedScopes = normalizeScopes(req.query.scopes || DEFAULT_SCOPES) || 'public_profile'

  res.cookie('fb_oauth_state', state, {
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
        )}&fb_retry=${encodeURIComponent('/auth/facebook/login?scopes=public_profile')}`
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

    const sid = crypto.randomBytes(18).toString('hex')
    sessions.set(sid, {
      createdAt: Date.now(),
      accessToken,
      user: me,
      pages
    })

    res.clearCookie('fb_oauth_state')
    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    })

    res.redirect(`${FRONTEND_ORIGIN}/?fb=1`)
  } catch (e) {
    res.redirect(`${FRONTEND_ORIGIN}/?fb_error=${encodeURIComponent(e?.message || 'OAuth callback failed')}`)
  }
})

app.post('/auth/logout', (req, res) => {
  const sid = req.cookies?.[SESSION_COOKIE]
  if (sid) sessions.delete(sid)
  res.clearCookie(SESSION_COOKIE)
  res.json({ success: true })
})

app.get('/api/me', async (req, res) => {
  const s = requireSession(req)
  if (!s) return res.status(401).json({ success: false, error: 'Not signed in' })

  const first = s.pages?.[0] || null

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
      selectedPageId: first?.id || null,
      pageAccessToken: first?.access_token || null
    }
  })
})

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
})

