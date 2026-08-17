# MaClips

Personal vertical video clipping for phone. Open the site, add it to your Home Screen, pick a take from Photos or record one, then say what to keep.

Clips stay on the device. The Netlify function only sees your prompt and timestamps.

## Local

```bash
npm install
npm test
npm run dev
```

## Deploy

Netlify build command is `npm run build`, publish directory `dist`. Enable AI Gateway after the first production deploy so `/api/suggest` can use `gpt-4o-mini`. Without the gateway, clipping still runs on-device.
