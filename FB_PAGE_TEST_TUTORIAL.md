# Step-by-step: Test posting to your Facebook Page

This guide matches **Social Echo** in this repo: Vite on **http://localhost:8000**, API on **http://localhost:8001** (see `vite.config.js` and `PORT` in `.env`).

---

## Part A — Meta (Facebook) Developer setup

### 1. Create an app

1. Open [Meta for Developers](https://developers.facebook.com/).
2. **My Apps** → **Create App** → choose a use case that supports **Facebook Login** (e.g. “Authenticate and request data from users with Facebook Login” or the closest option Meta shows).
3. Note the **App ID**. In the app dashboard go to **App settings → Basic** and click **Show** next to **App secret** to copy the **App secret** (keep it private; never commit it to git).

### 2. Add Facebook Login

1. In the app left menu, **Add product** → **Facebook Login** → **Set up**.
2. Under **Facebook Login → Settings**, find **Valid OAuth Redirect URIs**.
3. Add **exactly** (no trailing slash unless you always use one):

   `http://localhost:8000/auth/facebook/callback`

   This must match **`FRONTEND_ORIGIN`** in your `.env` (default in `server/index.js` is `http://localhost:8000`). If you use another port, change both Meta and `.env`.

### 3. App mode — sino ang makakapag-login at makapag-post?

**Sa web app na ito (code):** Walang “allowed users list” o email whitelist. **Sinumang matagumpay na mag-Facebook login** at may **Page na pamamahalaan** (at na-grant ang kailangang permissions) ay puwedeng gumamit ng **Create Post** at mag-publish sa Page na pinili sa dropdown.

**Sa Meta Developer Console** ang limit kung *ilan* ang makakapag-login sa Facebook OAuth:

| Meta app mode | Praktikal na kahulugan |
|---------------|------------------------|
| **Development** | Karaniwang **App roles** lang (Admin / Developer / Tester) at **Test Users** ang makakapag-login. Hindi arbitrary na “kahit sinong stranger” maliban idinagdag mo sila sa roles o bilang Test User. |
| **Live** | Mas malawak na audience; para sa Page posting (`pages_manage_posts`, atbp.) karaniwang kailangan ng **App Review** bago payagan ng Meta ang pangkalahatang publiko. |

**Kung gusto mong maraming tao (officemates, LGU staff) ang makatest habang Development:** sa Meta app → **App roles → Roles** → idagdag sila bilang **Developer** o **Tester** (o gumawa ng **Test Users**). Pagkatapos ay makakalog-in at makakapag-post sila sa web app tulad mo.

**Kung gusto mong literal na “kahit sinong Facebook user sa buong mundo”:** ilipat ang app sa **Live**, tapusin ang **App Review** para sa mga permission na kailangan, at sundin ang [Meta Platform Terms](https://developers.facebook.com/terms/).

### 4. Permissions for posting to a Page

The server loads Pages with `me/accounts` after login. For posting you typically need permissions such as:

- `pages_show_list`
- `pages_manage_posts`  
(and sometimes others, depending on your app’s use case in the dashboard)

**Where to set them in this project**

- In `.env` you can set for example:

  `FACEBOOK_LOGIN_SCOPES=public_profile,email,pages_show_list,pages_manage_posts`

  (Adjust to what your app has **enabled** under **Use cases / Permissions** in the Meta dashboard; invalid or unavailable scopes cause errors on the Facebook login screen.)

### 5. Facebook Page you manage

- You must **own or be an admin/editor** of a **Facebook Page** (not only a personal profile).
- After login, Meta returns Page tokens only for Pages your account can manage with the granted permissions.

---

## Part B — Project `.env` (project root)

Create or edit **`.env`** next to `package.json` (not inside `server/`). Example shape:

```env
# Frontend + server read these
FRONTEND_ORIGIN=http://localhost:8000

# App ID (numeric) — VITE_ is fine for the ID
VITE_FACEBOOK_APP_ID=YOUR_APP_ID_HERE

# Server-only — never expose in frontend bundles
FACEBOOK_APP_SECRET=YOUR_APP_SECRET_HERE

# API port (must match vite proxy target)
PORT=8001

# Optional: scopes for Page posting (comma-separated, no spaces if possible)
FACEBOOK_LOGIN_SCOPES=public_profile,email,pages_show_list,pages_manage_posts

# LGU Facebook Page (recommended): numeric Page id from Meta → your Page → About.
# The web app only publishes to this Page. If omitted, the first Page whose name includes the word "LGU" is used.
# FACEBOOK_LGU_PAGE_ID=123456789012345
```

Save the file, then **restart the API** after any change to `.env`.

---

## Part C — Run backend and frontend

From the project folder in a terminal:

```bash
npm install
```

**Option 1 — one command (recommended on your PC):**

```bash
npm run dev:all
```

**Option 2 — two terminals:**

```bash
# Terminal 1 — API
npm run dev:server

# Terminal 2 — Vite
npm run dev
```

Open the app: **http://localhost:8000/**

---

## Part D — Test login and publish

1. Click **Continue with Facebook** (or the Facebook login control in the header).
2. You should be redirected to **facebook.com** to approve the app; accept the requested permissions.
3. After success, Meta redirects back to your app (e.g. `http://localhost:8000/?fb=1`). You should see your **name** and **Logout** in the navbar.
4. In **Create Post**, if you have **more than one Page**, pick the **Facebook Page** from the dropdown; otherwise it posts to the default Page shown.
5. Enter text (and optionally an image), then **Publish** → sa confirmation dialog, tingnan ang Page na target → **Confirm**. Ang publish ay tumatakbo sa **server** gamit ang login session mo (`/api/lgu/posts` para sa text, `/api/page/photo-post` para sa larawan), kaya **doon mismo sa napiling Page** lalabas sa Facebook.
6. Open your **Facebook Page** in a browser (as a visitor or logged in) and confirm the new post appears on the Page’s timeline.

---

## Part E — Paano malaman na nailipat na sa Facebook Page mo (hal. “TANGA lang”)

### Sa web app mismo

1. Pag successful ang publish, may **toast** na “Published to Facebook.” (o katumbas na mensahe).
2. Sa **feed** sa ibaba, tingnan ang bagong card ng post: kung may nakuha ang app na permalink mula sa Graph API, may link na **View on Facebook** — iyon ang direktang bukas sa post sa Facebook.

### Sa Facebook (Page na “TANGA lang” o anuman ang pangalan)

1. **Siguraduhing tama ang target Page** sa **Create Post** → dropdown na **Facebook Page** (kung marami kang Page). Dapat napili ang **TANGA lang**; kung hindi, mapupunta ang post sa ibang Page.
2. Buksan ang Page mo sa browser (hal. profile mo sa screenshot: `https://www.facebook.com/diaryngbobourl/` — ang URL ay maaaring iba sa display name).
3. Sa **Manage Page** view, scroll sa ilalim ng **Posts** — doon lumalabas ang mga bagong post sa timeline ng Page (pinakabago sa itaas maliban kung may pin).
4. O sa **left sidebar** → **Meta Business Suite** → hanapin ang **Content** / **Posts** para makita ang listahan ng nailathalang post (may oras / status).
5. **Optional:** Buksan ang parehong Page URL sa **Incognito / private window** para makita kung ano ang nakikita ng publiko.

Kung walang lumabas sa Page pero success sa app: tingnan kung hindi napunta sa ibang Page, o kung may error mula sa Graph (permissions, unpublished Page, atbp.).

---

## If something fails

| Symptom | What to check |
|--------|----------------|
| **HTTP 500 / 503** on `/auth/facebook/login` | `.env` has `VITE_FACEBOOK_APP_ID` or `FACEBOOK_APP_ID`, and **`FACEBOOK_APP_SECRET`**. Restart `npm run dev:server`. |
| **“Can’t load URL” / redirect URI** | Redirect URI in Meta must match **`FRONTEND_ORIGIN` + `/auth/facebook/callback`** exactly. |
| **Invalid scopes** | Remove scopes your app has not enabled; start with `public_profile,email` then add Page scopes one by one. |
| **Proxy / connection refused** | API must be on **8001** (or whatever `vite.config.js` `proxy.target` uses) while Vite runs on **8000**. |
| **Login works but publish fails** | Permissions for `pages_manage_posts`, Page role, or app still in **Development** with your account not added as a role/tester. |

---

## Quick checklist

- [ ] Redirect URI: `http://localhost:8000/auth/facebook/callback`
- [ ] `.env`: `FRONTEND_ORIGIN`, App ID, `FACEBOOK_APP_SECRET`, `PORT=8001`
- [ ] Optional: `FACEBOOK_LOGIN_SCOPES` aligned with Meta dashboard
- [ ] Your Facebook user is **Admin/Developer** on the app (in dev)
- [ ] You manage at least one **Facebook Page**
- [ ] `npm run dev:all` (or both servers), then **http://localhost:8000/**
