# Echo Shelf

Echo Shelf is an original, local-first web music player designed for public deployment without relying on third-party music platforms.

## What It Does

- Plays audio files that users select from their own device.
- Keeps playlists and lyrics in browser local storage.
- Does not upload, proxy, cache, scrape, download, or distribute music files.
- Does not use KuGou, MoeKoeMusic, or any other music platform API, code, name, icon, playlist, lyrics, MV, account system, or private endpoint.

## Compliance Boundary

This project is intended to be a neutral player for files that the user owns or is licensed to use.

Do not deploy or modify it to:

- Connect to non-public music platform APIs.
- Offer copyrighted songs, lyrics, album art, or videos without authorization.
- Provide download, ripping, cache extraction, VIP bypass, or account automation features.
- Use names, logos, screenshots, or visual identity from KuGou, MoeKoeMusic, or other music services.
- Advertise the site as a replacement client for any official music platform.

No software project can guarantee absolute legal safety in every jurisdiction. For a public service, consult a qualified lawyer before adding online music sources or user-upload hosting.

## Publishing

This is a static site. You can deploy the folder to any static host:

- Netlify
- EdgeOne Pages
- GitHub Pages
- Cloudflare Pages
- any ordinary web server

The first screen is the player itself. No build step is required.

## Suggested Site Disclaimer

Use wording like this on the published site:

> Echo Shelf is an independent local music player. It is not affiliated with any music platform. Users are responsible for selecting only audio and lyric files they own or are authorized to use. This site does not provide online songs, downloads, account login, VIP bypass, or third-party music platform access.

## License

MIT. See `LICENSE`.
