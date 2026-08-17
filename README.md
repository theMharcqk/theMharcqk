# MaClips

Personal vertical video clipping for phone. Open the site, add it to your Home Screen, pick a take from Photos or record one, then say what to keep.

Clips stay on the device. The Netlify function only sees your prompt and timestamps.

## On your phone

1. Open the live `*.netlify.app` URL in Safari (iPhone) or Chrome (Android).
2. Add MaClips to your Home Screen so it opens as a full-screen app.
3. Tap **Photos** or **Record**, then type what to keep and tap **Clip**.
4. Keep or skip each clip, then tap **Save clip**.
5. iPhone opens the share sheet. Android shares or downloads a 9:16 file.

Use Safari 18+ or Chrome. Export runs on the phone, so keep the tab open until it finishes.

## Go live

Netlify build command is `npm test && npm run build`, publish directory `dist`, Node 22.

1. Import this GitHub repo in Netlify (or `npx netlify deploy --prod --build` with a personal access token).
2. Set the production branch to the branch that contains MaClips. `main` is empty until that branch is merged.
3. After the first production deploy, enable **AI** / AI Gateway in the Netlify site settings so `/api/suggest` can use `gpt-4o-mini`. Do not set your own `OPENAI_API_KEY`.
4. Open the HTTPS URL on your phone and add it to the Home Screen.

Without the gateway, clipping still runs on-device.

## Local

```bash
npm install
npm test
npm run dev
```
