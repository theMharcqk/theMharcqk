# MaClips

Personal vertical video clipping for phone. Open the site, add it to your Home Screen, pick a take from Photos or record one, then say what to keep.

Clips stay on the device. The Netlify function only sees your prompt and timestamps.

## On your phone

1. Open the Netlify URL in Safari (iPhone) or Chrome (Android).
2. Add MaClips to your Home Screen so it opens as a full-screen app.
3. Tap **Photos** or **Record**, then type what to keep and tap **Clip**.
4. Keep or skip each clip, then tap **Save clip**.
5. iPhone opens the share sheet. Android shares or downloads a 9:16 file.

Use Safari 18+ or Chrome. Export runs on the phone, so keep the tab open until it finishes.

## Local

```bash
npm install
npm test
npm run dev
```

## Deploy

Netlify build command is `npm run build`, publish directory `dist`. Enable AI Gateway after the first production deploy so `/api/suggest` can use `gpt-4o-mini`. Without the gateway, clipping still runs on-device.
