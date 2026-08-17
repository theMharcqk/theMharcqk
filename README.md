# MaClips

Personal vertical video clipping. Upload a take, say what to keep, export a 9:16 clip.

Videos are clipped in the browser. The Netlify function only sees your prompt and timestamps.

## Local

```bash
npm install
npm test
npm run dev
```

## Deploy

Netlify build command is `npm run build`, publish directory `dist`. Enable AI Gateway after the first production deploy so `/api/suggest` can use `gpt-4o-mini`. Without the gateway, clipping still runs on-device.
