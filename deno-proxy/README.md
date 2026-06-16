# Shiyin Box Deno Proxy

This proxy is optional. It helps the static GitHub Pages site search public podcasts, read public RSS feeds, and search public radio directories.

## Endpoints

- `GET /health`
- `GET /podcast/search?q=keyword`
- `GET /podcast/feed?url=https://example.com/feed.xml`
- `GET /radio/search?q=news`
- `POST /ai/summary` placeholder
- `POST /ai/transcript` placeholder

## Deploy

1. Create a Deno Deploy project.
2. Use `main.ts` as the entry file.
3. Copy the deployed URL.
4. Put the URL in `../config.js`:

```js
window.SHIYIN_RADIO_PROXY_URL = "https://your-deno-project.deno.dev";
```

The proxy should stay limited to public RSS feeds and public radio directories. It does not store audio files.

The AI endpoints return a clear "not configured" response by default. Add your own model provider on the proxy side if you want to enable summaries or transcripts. Never put API keys in the public frontend.
