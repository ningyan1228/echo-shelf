const RADIO_BROWSER_API_URL = "https://de1.api.radio-browser.info/json";
const PODCAST_SEARCH_API_URL = "https://itunes.apple.com/search";
const RESULT_LIMIT = 12;
const RADIO_FETCH_LIMIT = 36;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (request) => {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(request.method)) {
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/health") {
    return json({ ok: true });
  }

  if (url.pathname === "/radio/search") {
    const query = normalizeQuery(url.searchParams.get("q"));
    try {
      const tracks = await searchRadio(query);
      return json({ source: "Radio Browser", query, tracks }, 200, {
        "Cache-Control": "public, max-age=300",
      });
    } catch (error) {
      return json({ error: errorMessage(error) }, 502);
    }
  }

  if (url.pathname === "/podcast/feed") {
    const feedUrl = url.searchParams.get("url") || "";
    try {
      const tracks = await readPodcastFeed(feedUrl);
      return json({ source: "Public podcast RSS", tracks }, 200, {
        "Cache-Control": "public, max-age=600",
      });
    } catch (error) {
      return json({ error: errorMessage(error) }, 400);
    }
  }

  if (url.pathname === "/podcast/search") {
    const query = normalizeQuery(url.searchParams.get("q"));
    try {
      const podcasts = await searchPodcasts(query);
      return json({ source: "Public podcast directory", query, podcasts }, 200, {
        "Cache-Control": "public, max-age=600",
      });
    } catch (error) {
      return json({ error: errorMessage(error) }, 502);
    }
  }

  if (url.pathname === "/ai/summary" || url.pathname === "/ai/transcript") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    return json(
      {
        error: "AI is not configured. Add your own model provider in this Deno proxy before enabling summaries or transcripts.",
      },
      501,
    );
  }

  return json({ error: "Not found" }, 404);
});

async function searchRadio(query) {
  const term = toDomesticRadioQuery(query);
  const domesticTagged = await radioSearch({ countrycode: "CN", tag: term });
  const domesticNamed = await radioSearch({ countrycode: "CN", name: term });
  const chineseTagged = await radioSearch({ language: "chinese", tag: term });
  const chineseNamed = await radioSearch({ language: "chinese", name: term });
  const domesticFallback = domesticTagged.length + domesticNamed.length >= 4 ? [] : await radioSearch({ countrycode: "CN" });
  const stations = [...domesticTagged, ...domesticNamed, ...chineseTagged, ...chineseNamed, ...domesticFallback];
  const seen = new Set();

  return stations
    .map(createRadioTrack)
    .filter((track) => {
      if (!track || seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    })
    .slice(0, RESULT_LIMIT);
}

function toDomesticRadioQuery(query) {
  const map = {
    news: "新闻",
    talk: "谈话",
    finance: "财经",
    traffic: "交通",
    music: "音乐",
    literature: "读书",
    local: "广播",
    podcast: "播客",
    world: "中文",
    ambient: "音乐",
    jazz: "音乐",
    classical: "音乐",
    electronic: "音乐",
  };
  return map[query] || query || "中文";
}

async function radioSearch(params) {
  const url = new URL(`${RADIO_BROWSER_API_URL}/stations/search`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("hidebroken", "true");
  url.searchParams.set("limit", String(RADIO_FETCH_LIMIT));
  url.searchParams.set("order", "clickcount");
  url.searchParams.set("reverse", "true");

  const data = await fetchJson(url);
  return Array.isArray(data) ? data : [];
}

function createRadioTrack(station) {
  const streamUrl = station.url_resolved || station.url;
  const codec = String(station.codec || "").toLowerCase();
  if (!isPlayableRadioStream(streamUrl, codec)) return null;

  const country = [station.countrycode, station.language].filter(Boolean).join(" · ");
  const bitrate = Number(station.bitrate || 0);
  const meta = [codec.toUpperCase(), bitrate ? `${bitrate}kbps` : "", country].filter(Boolean).join(" · ");

  return {
    id: `radio-${station.stationuuid}`,
    title: station.name || "Untitled station",
    artist: station.tags || "Public radio",
    fileName: streamUrl,
    size: 0,
    duration: 0,
    playable: true,
    remote: true,
    url: streamUrl,
    sourceName: meta || "Public radio",
    sourceUrl: station.homepage || streamUrl,
    licenseUrl: station.homepage || "",
    licenseLabel: "LIVE",
    radioClickUrl: `${RADIO_BROWSER_API_URL}/url/${station.stationuuid}`,
  };
}

async function readPodcastFeed(feedUrl) {
  const parsed = new URL(feedUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only public http/https RSS feeds are supported");
  }

  const response = await fetch(parsed, {
    headers: {
      "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "User-Agent": "ShiyinBoxPodcastProxy/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`RSS request failed: ${response.status}`);
  }

  const xml = await response.text();
  const channelTitle = textBetween(xml, /<channel\b[\s\S]*?<title\b[^>]*>([\s\S]*?)<\/title>/i) || "Podcast";
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return items.map((item, index) => createPodcastTrack(item, channelTitle, parsed.href, index))
    .filter(Boolean)
    .slice(0, RESULT_LIMIT);
}

function createPodcastTrack(item, channelTitle, feedUrl, index) {
  const enclosure = item.match(/<enclosure\b[^>]*>/i)?.[0] || "";
  const url = attr(enclosure, "url");
  const type = attr(enclosure, "type").toLowerCase();
  if (!url || !isPlayablePodcastAudio(url, type)) return null;

  const title = textBetween(item, /<title\b[^>]*>([\s\S]*?)<\/title>/i) || `Episode ${index + 1}`;
  const author = textBetween(item, /<itunes:author\b[^>]*>([\s\S]*?)<\/itunes:author>/i) || channelTitle;
  const link = textBetween(item, /<link\b[^>]*>([\s\S]*?)<\/link>/i) || feedUrl;
  const length = Number(attr(enclosure, "length") || 0);

  return {
    id: `podcast-${hash(`${feedUrl}:${url}`)}`,
    title: decodeXml(title),
    artist: decodeXml(author),
    fileName: url,
    size: length,
    duration: 0,
    playable: true,
    remote: true,
    url,
    sourceName: `Podcast · ${decodeXml(channelTitle)}`,
    sourceUrl: link,
    licenseUrl: link,
    licenseLabel: "RSS",
  };
}

async function searchPodcasts(query) {
  const url = new URL(PODCAST_SEARCH_API_URL);
  url.searchParams.set("term", query);
  url.searchParams.set("media", "podcast");
  url.searchParams.set("entity", "podcast");
  url.searchParams.set("limit", String(RESULT_LIMIT));
  url.searchParams.set("country", "CN");
  url.searchParams.set("lang", "zh_cn");

  const data = await fetchJson(url);
  const results = Array.isArray(data?.results) ? data.results : [];

  return results
    .map(createPodcastResult)
    .filter(Boolean);
}

function createPodcastResult(item) {
  const feedUrl = item.feedUrl || "";
  if (!/^https?:\/\//i.test(feedUrl)) return null;

  return {
    title: item.collectionName || item.trackName || "Untitled podcast",
    author: item.artistName || "Unknown creator",
    description: [item.primaryGenreName, item.country].filter(Boolean).join(" · ") || "公开 RSS 播客",
    genres: Array.isArray(item.genres) ? item.genres.join(" · ") : "",
    feedUrl,
    sourceUrl: item.collectionViewUrl || item.trackViewUrl || feedUrl,
    artworkUrl: item.artworkUrl100 || item.artworkUrl60 || "",
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "ShiyinBoxRadioProxy/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Upstream request failed: ${response.status}`);
  }

  return await response.json();
}

function isPlayableRadioStream(url, codec) {
  if (!/^https?:\/\//i.test(String(url || ""))) return false;
  if (/\.(m3u|pls|asx)(?:$|\?)/i.test(url)) return false;
  if (/mpeg|mp3|aac|aacp|ogg|opus/.test(codec)) return true;
  return /\.(mp3|aac|ogg|oga|opus)(?:$|\?)/i.test(url);
}

function isPlayablePodcastAudio(url, type) {
  if (!/^https?:\/\//i.test(String(url || ""))) return false;
  if (/audio\/(mpeg|mp3|aac|mp4|x-m4a|ogg|opus)/i.test(type)) return true;
  return /\.(mp3|m4a|aac|ogg|oga|opus)(?:$|\?)/i.test(url);
}

function normalizeQuery(value) {
  return String(value || "world")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40) || "world";
}

function textBetween(value, pattern) {
  return decodeXml(value.match(pattern)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() || "");
}

function attr(tag, name) {
  return decodeXml(tag.match(new RegExp(`${name}=[\"']([^\"']+)[\"']`, "i"))?.[1] || "");
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(31, result) + value.charCodeAt(index) | 0;
  }
  return Math.abs(result).toString(36);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : "Request failed";
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
