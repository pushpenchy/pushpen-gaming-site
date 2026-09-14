# Pushpen Gaming — channel website

Brand site for the [Pushpen Gaming](https://www.youtube.com/@PushpenGaming) YouTube channel.
Static HTML + one serverless function, built to deploy on Vercel.

```
index.html        the site (all CSS/JS inline)
api/youtube.js    GET /api/youtube → channel stats + latest uploads
assets/           logo, icon, Open Graph banner
```

## Deploy on Vercel

1. Push this repo to GitHub (already done if you are reading this there).
2. Go to <https://vercel.com/new>, import the repo, keep every setting as default, click **Deploy**.
3. Your site is live at `https://<project>.vercel.app`. Add a custom domain under **Settings → Domains** if you have one.

## Live YouTube data

The site calls `/api/youtube` on load and fills in:

- **Latest uploads** grid — works out of the box (uses the channel's public RSS feed).
  New videos and counts refresh automatically every 2 minutes.
- **Subscribers / videos / total views** tiles — need a free YouTube Data API key:
  1. Open <https://console.cloud.google.com/>, create a project, enable **YouTube Data API v3**.
  2. **Credentials → Create credentials → API key**. Copy it.
  3. In Vercel: **Project → Settings → Environment Variables** → add `YOUTUBE_API_KEY` = your key → **Redeploy**.

  With the key set, the function also returns higher-resolution thumbnails and per-video view counts.

## Editing

- Social links: near the bottom of `index.html`, set `FB_URL`, `IG_URL`, `X_URL`.
- Copy, games, colours: everything is in `index.html`; brand tokens are the CSS variables at the top.
- Channel: `CHANNEL_ID` in `api/youtube.js` and `YT_URL` in `index.html`.

## Local preview

```bash
npx vercel dev
```
(or just open `index.html` — everything works except the live data section).
