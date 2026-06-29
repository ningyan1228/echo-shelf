const RADIO_PROXY_URL = "";
const ARCHIVE_SEARCH_URL = "https://archive.org/advancedsearch.php";
const RADIO_BROWSER_API_URL = "https://all.api.radio-browser.info/json";
const OPEN_MUSIC_RESULT_LIMIT = 12;
const RADIO_STATION_LIMIT = 24;

const radioChannels = {
  news: { title: "国内新闻", query: "新闻" },
  talk: { title: "中文谈话", query: "谈话" },
  finance: { title: "财经广播", query: "财经" },
  traffic: { title: "交通广播", query: "交通" },
  music: { title: "华语音乐", query: "音乐" },
  literature: { title: "人文读书", query: "读书" },
  local: { title: "地方电台", query: "广播" },
  podcast: { title: "中文播客", query: "播客" },
};

const els = {
  audio: document.querySelector("#audio"),
  fileInput: document.querySelector("#fileInput"),
  searchInput: document.querySelector("#searchInput"),
  trackList: document.querySelector("#trackList"),
  queueList: document.querySelector("#queueList"),
  openMusicForm: document.querySelector("#openMusicForm"),
  openMusicQuery: document.querySelector("#openMusicQuery"),
  openMusicStatus: document.querySelector("#openMusicStatus"),
  openMusicResults: document.querySelector("#openMusicResults"),
  podcastResults: document.querySelector("#podcastResults"),
  radioSearchBtn: document.querySelector("#radioSearchBtn"),
  radioTitle: document.querySelector("#radioTitle"),
  radioShuffleBtn: document.querySelector("#radioShuffleBtn"),
  studioView: document.querySelector("#studioView"),
  visualizer: document.querySelector("#visualizer"),
  visualizerTitle: document.querySelector("#visualizerTitle"),
  buildMixBtn: document.querySelector("#buildMixBtn"),
  trackCountStat: document.querySelector("#trackCountStat"),
  durationStat: document.querySelector("#durationStat"),
  queueStat: document.querySelector("#queueStat"),
  playlistGrid: document.querySelector("#playlistGrid"),
  playlistForm: document.querySelector("#playlistForm"),
  playlistName: document.querySelector("#playlistName"),
  lyricsInput: document.querySelector("#lyricsInput"),
  lyricsDisplay: document.querySelector("#lyricsDisplay"),
  saveLyricsBtn: document.querySelector("#saveLyricsBtn"),
  aiTrackTitle: document.querySelector("#aiTrackTitle"),
  aiTrackMeta: document.querySelector("#aiTrackMeta"),
  aiSummaryBtn: document.querySelector("#aiSummaryBtn"),
  aiTranscriptBtn: document.querySelector("#aiTranscriptBtn"),
  aiOutput: document.querySelector("#aiOutput"),
  clearLibraryBtn: document.querySelector("#clearLibraryBtn"),
  clearQueueBtn: document.querySelector("#clearQueueBtn"),
  nowTitle: document.querySelector("#nowTitle"),
  nowArtist: document.querySelector("#nowArtist"),
  playBtn: document.querySelector("#playBtn"),
  playerMessage: document.querySelector("#playerMessage"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  repeatBtn: document.querySelector("#repeatBtn"),
  focusModeBtn: document.querySelector("#focusModeBtn"),
  themeToggleBtn: document.querySelector("#themeToggleBtn"),
  progress: document.querySelector("#progress"),
  currentTime: document.querySelector("#currentTime"),
  duration: document.querySelector("#duration"),
  volume: document.querySelector("#volume"),
  viewTitle: document.querySelector("#viewTitle"),
};

const views = {
  library: document.querySelector("#libraryView"),
  queue: document.querySelector("#queueView"),
  studio: document.querySelector("#studioView"),
  open: document.querySelector("#openView"),
  playlists: document.querySelector("#playlistsView"),
  lyrics: document.querySelector("#lyricsView"),
  ai: document.querySelector("#aiView"),
  about: document.querySelector("#aboutView"),
};

const state = {
  tracks: [],
  queue: [],
  playlists: loadJson("lumaCrate.playlists", []),
  lyrics: loadJson("lumaCrate.lyrics", {}),
  currentId: null,
  objectUrls: new Map(),
  shuffle: false,
  repeat: "off",
  activeView: "library",
  mood: localStorage.getItem("lumaCrate.mood") || "default",
  theme: localStorage.getItem("lumaCrate.theme") || "light",
  visualizerReady: false,
  audioContext: null,
  analyser: null,
  source: null,
  animationId: null,
  openResults: [],
  podcastResults: [],
};

document.body.dataset.mood = state.mood;
document.body.dataset.theme = state.theme;
els.audio.crossOrigin = "anonymous";
els.audio.volume = Number(localStorage.getItem("lumaCrate.volume") || "0.85");
els.volume.value = String(els.audio.volume);

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeTrack(file) {
  const cleanName = file.name.replace(/\.[^/.]+$/, "");
  const parts = cleanName.split(/\s+-\s+/);
  const artist = parts.length > 1 ? parts[0].trim() : "本地文件";
  const title = parts.length > 1 ? parts.slice(1).join(" - ").trim() : cleanName;

  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${makeId()}`,
    title,
    artist,
    fileName: file.name,
    size: file.size,
    file,
    duration: 0,
    playable: isLikelyPlayable(file),
  };
}

function isLikelyPlayable(file) {
  const lowerName = file.name.toLowerCase();
  const extension = lowerName.split(".").pop() || "";
  if (/(^|[.\s_-])(kgm|kgma|vpr)([.\s_-]|$)/i.test(lowerName)) return false;
  if (["kgm", "kgma", "vpr"].includes(extension)) return false;
  const knownStandardAudio = ["mp3", "flac", "wav", "m4a", "aac", "ogg", "oga", "opus", "webm"];
  if (!knownStandardAudio.includes(extension)) return false;
  if (!file.type) return true;
  return Boolean(els.audio.canPlayType(file.type)) || knownStandardAudio.includes(extension);
}

function getUrl(track) {
  if (track.url) return track.url;
  if (!state.objectUrls.has(track.id)) {
    state.objectUrls.set(track.id, URL.createObjectURL(track.file));
  }
  return state.objectUrls.get(track.id);
}

function setView(name) {
  state.activeView = name;
  Object.entries(views).forEach(([key, el]) => el.classList.toggle("active-view", key === name));
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  els.viewTitle.textContent = {
    library: "曲库",
    queue: "播放队列",
    studio: "声景",
    open: "播客电台",
    playlists: "歌单",
    lyrics: "歌词",
    ai: "AI",
    about: "合规说明",
  }[name];
}

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatSize(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function filteredTracks() {
  const q = els.searchInput.value.trim().toLowerCase();
  if (!q) return state.tracks;
  return state.tracks.filter((track) => {
    return [track.title, track.artist, track.fileName].some((value) => value.toLowerCase().includes(q));
  });
}

function render() {
  renderTracks();
  renderQueue();
  renderPlaylists();
  renderLyrics();
  renderAiPanel();
  renderStudio();
  renderPodcastResults();
  renderOpenMusic();
  updateNowPlaying();
}

function renderTracks() {
  const tracks = filteredTracks();
  if (!tracks.length) {
    els.trackList.innerHTML = `<div class="empty-state">导入本地音频后，这里会显示你的私人曲库。</div>`;
    return;
  }

  els.trackList.innerHTML = tracks.map((track, index) => trackRow(track, index, "library")).join("");
}

function renderQueue() {
  const queuedTracks = state.queue.map(findTrack).filter(Boolean);
  if (!queuedTracks.length) {
    els.queueList.innerHTML = `<div class="empty-state">播放队列为空。</div>`;
    return;
  }

  els.queueList.innerHTML = queuedTracks.map((track, index) => trackRow(track, index, "queue")).join("");
}

function trackRow(track, index, context) {
  const isPlaying = state.currentId === track.id;
  const statusText = track.playable ? formatSize(track.size) : "不支持";
  const thirdAction = track.sourceUrl ? "source" : "playlist";
  const thirdTitle = track.sourceUrl ? "查看来源" : "加入歌单";
  return `
    <article class="track-row ${isPlaying ? "playing" : ""}" data-id="${track.id}" data-context="${context}">
      <div class="track-index">${isPlaying ? "▶" : index + 1}</div>
      <div class="track-main">
        <strong>${escapeHtml(track.title)}</strong>
        <span>${escapeHtml(track.sourceName || track.fileName)}</span>
      </div>
      <div class="track-meta">${escapeHtml(track.artist)}</div>
      <div class="track-duration">${track.licenseLabel || (track.duration ? formatTime(track.duration) : statusText)}</div>
      <div class="row-actions">
        <button class="icon-button" data-action="play" title="播放" aria-label="播放">▶</button>
        <button class="icon-button" data-action="queue" title="加入队列" aria-label="加入队列">+</button>
        <button class="icon-button" data-action="${thirdAction}" title="${thirdTitle}" aria-label="${thirdTitle}">${track.sourceUrl ? "↗" : "≡"}</button>
      </div>
    </article>
  `;
}

function findTrack(id) {
  return state.tracks.find((track) => track.id === id) || state.openResults.find((track) => track.id === id);
}

function renderPlaylists() {
  if (!state.playlists.length) {
    els.playlistGrid.innerHTML = `<div class="empty-state">还没有歌单。</div>`;
    return;
  }

  els.playlistGrid.innerHTML = state.playlists
    .map((playlist) => {
      const count = playlist.trackIds.filter((id) => state.tracks.some((track) => track.id === id)).length;
      return `
        <article class="playlist-card" data-id="${playlist.id}">
          <strong>${escapeHtml(playlist.name)}</strong>
          <span>${count} 首本地歌曲</span>
          <div class="playlist-actions">
            <button class="ghost-button" data-action="play-playlist">播放</button>
            <button class="ghost-button" data-action="delete-playlist">删除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function parseLyrics(raw) {
  const lines = raw.split(/\r?\n/);
  const parsed = [];
  for (const line of lines) {
    const match = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (!match) {
      if (line.trim()) parsed.push({ time: null, text: line.trim() });
      continue;
    }
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const millis = Number((match[3] || "0").padEnd(3, "0"));
    parsed.push({ time: minutes * 60 + seconds + millis / 1000, text: match[4] || " " });
  }
  return parsed;
}

function renderLyrics() {
  const raw = state.currentId ? state.lyrics[state.currentId] || "" : "";
  if (document.activeElement !== els.lyricsInput) {
    els.lyricsInput.value = raw;
  }

  const parsed = parseLyrics(raw);
  if (!parsed.length) {
    els.lyricsDisplay.textContent = "暂无歌词";
    return;
  }

  const current = els.audio.currentTime;
  let activeIndex = -1;
  parsed.forEach((line, index) => {
    if (line.time !== null && line.time <= current) activeIndex = index;
  });

  els.lyricsDisplay.innerHTML = parsed
    .map((line, index) => {
      const className = index === activeIndex ? "lyric-line active" : "lyric-line";
      return `<div class="${className}">${escapeHtml(line.text)}</div>`;
    })
    .join("");
}

function renderAiPanel() {
  if (!els.aiTrackTitle) return;
  const track = findTrack(state.currentId);
  els.aiTrackTitle.textContent = track?.title || "未选择节目";
  els.aiTrackMeta.textContent = track
    ? `${track.artist || "Unknown creator"} · ${track.sourceName || track.fileName}`
    : "播放或选择公开播客单集后，可在这里发起摘要或转文字。";
}

function renderStudio() {
  els.trackCountStat.textContent = String(state.tracks.length);
  const totalDuration = state.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  els.durationStat.textContent = totalDuration ? formatTime(totalDuration) : "0:00";
  els.queueStat.textContent = String(state.queue.length);
  const current = state.tracks.find((track) => track.id === state.currentId);
  els.visualizerTitle.textContent = current ? `${current.title} · ${current.artist}` : "等待播放";
  document.querySelectorAll(".mood-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mood === state.mood);
  });
  drawIdleVisualizer();
}

function renderOpenMusic() {
  if (!els.openMusicResults) return;
  if (!state.openResults.length) {
    els.openMusicResults.innerHTML = `<div class="empty-state">搜索公开播客 RSS 或调频网络电台后，这里会显示可播放节目。</div>`;
    return;
  }
  els.openMusicResults.innerHTML = state.openResults.map((track, index) => trackRow(track, index, "open")).join("");
}

function renderPodcastResults() {
  if (!els.podcastResults) return;
  if (!state.podcastResults.length) {
    els.podcastResults.innerHTML = "";
    return;
  }

  els.podcastResults.innerHTML = state.podcastResults.map((podcast) => `
    <article class="podcast-card" data-feed-url="${escapeHtml(podcast.feedUrl || "")}" data-source-url="${escapeHtml(podcast.sourceUrl || "")}">
      <div>
        <strong>${escapeHtml(podcast.title)}</strong>
        <span>${escapeHtml(podcast.author || "Unknown creator")}</span>
      </div>
      <p>${escapeHtml(podcast.description || podcast.genres || "公开 RSS 播客")}</p>
      <div class="podcast-actions">
        <button type="button" data-action="episodes">单集</button>
        <button type="button" data-action="source">来源</button>
      </div>
    </article>
  `).join("");
}

function playTrack(id) {
  const track = findTrack(id);
  if (!track) return;
  if (!track.playable) {
    showPlayerMessage("不支持 .kgm/.kgma/.vpr 等非标准缓存格式。请使用你有权使用的 mp3、flac、wav、m4a、ogg 等标准音频。");
    return;
  }

  state.currentId = id;
  if (!state.queue.includes(id)) state.queue.push(id);
  els.audio.src = getUrl(track);
  recordRadioClick(track);
  try {
    setupVisualizer();
  } catch (error) {
    console.warn("Visualizer setup failed, audio playback will continue.", error);
  }
  els.audio.play().catch(() => {
    if (!markRemoteTrackFailed(track)) {
      showPlayerMessage("浏览器拒绝或无法解码这个音频文件。请换成标准音频格式后再试。");
    }
  });
  render();
}

function recordRadioClick(track) {
  if (!track?.radioClickUrl) return;
  fetch(track.radioClickUrl).catch(() => {});
}

function markRemoteTrackFailed(track) {
  if (!track?.remote) return false;
  track.playable = false;
  renderOpenMusic();
  const nextRemote = state.openResults.find((item) => item.playable && item.id !== track.id);
  if (nextRemote) {
    showPlayerMessage("这个节目源不可用，正在切换到下一个。");
    window.setTimeout(() => playTrack(nextRemote.id), 800);
    return true;
  }
  showPlayerMessage("这一组在线节目源都暂时不可用，请换一个频道。");
  return true;
}

function togglePlay() {
  if (!state.currentId) {
    const firstPlayable = state.tracks.find((track) => track.playable) || state.openResults.find((track) => track.playable);
    if (firstPlayable) playTrack(firstPlayable.id);
    else showPlayerMessage("请先导入 mp3、flac、wav、m4a、ogg 等标准音频。");
    return;
  }
  if (els.audio.paused) {
    els.audio.play().catch(() => {
      showPlayerMessage("当前音频无法播放。请确认文件格式是浏览器支持的标准音频。");
    });
  } else {
    els.audio.pause();
  }
}

function showPlayerMessage(message) {
  els.playerMessage.textContent = message;
  window.clearTimeout(showPlayerMessage.timer);
  showPlayerMessage.timer = window.setTimeout(() => {
    els.playerMessage.textContent = "";
  }, 6000);
}

function move(delta) {
  const list = state.queue.length ? state.queue : state.tracks.map((track) => track.id);
  if (!list.length) return;
  if (state.shuffle && delta > 0) {
    playTrack(list[Math.floor(Math.random() * list.length)]);
    return;
  }
  const currentIndex = Math.max(0, list.indexOf(state.currentId));
  const nextIndex = (currentIndex + delta + list.length) % list.length;
  playTrack(list[nextIndex]);
}

function updateNowPlaying() {
  const track = findTrack(state.currentId);
  els.nowTitle.textContent = track?.title || "未选择歌曲";
  els.nowArtist.textContent = track?.artist || "导入本地音频开始播放";
  els.playBtn.textContent = els.audio.paused ? "▶" : "Ⅱ";
  els.shuffleBtn.classList.toggle("shuffle-on", state.shuffle);
  els.repeatBtn.classList.toggle("repeat-on", state.repeat !== "off");
  els.repeatBtn.textContent = state.repeat === "one" ? "①" : "↻";
  els.focusModeBtn.classList.toggle("repeat-on", document.body.classList.contains("stage-mode"));
  els.themeToggleBtn.textContent = state.theme === "dark" ? "☾" : "☼";
  renderAiPanel();
}

function setupVisualizer() {
  if (state.visualizerReady) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  state.audioContext = new AudioContext();
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 128;
  state.source = state.audioContext.createMediaElementSource(els.audio);
  state.source.connect(state.analyser);
  state.analyser.connect(state.audioContext.destination);
  state.visualizerReady = true;
  animateVisualizer();
}

function animateVisualizer() {
  if (!els.visualizer || !state.analyser) return;
  const canvas = els.visualizer;
  const ctx = canvas.getContext("2d");
  const data = new Uint8Array(state.analyser.frequencyBinCount);
  const draw = () => {
    state.animationId = requestAnimationFrame(draw);
    state.analyser.getByteFrequencyData(data);
    paintBars(ctx, canvas, data);
  };
  draw();
}

function drawIdleVisualizer() {
  if (!els.visualizer || state.visualizerReady) return;
  const canvas = els.visualizer;
  const ctx = canvas.getContext("2d");
  const bars = Array.from({ length: 48 }, (_, index) => {
    const wave = Math.sin(index * 0.48 + Date.now() / 900);
    return 45 + Math.max(0, wave) * 80;
  });
  paintBars(ctx, canvas, bars);
}

function paintBars(ctx, canvas, data) {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, getComputedStyle(document.body).getPropertyValue("--accent").trim());
  gradient.addColorStop(1, getComputedStyle(document.body).getPropertyValue("--accent-2").trim());
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let i = 0; i < 8; i += 1) {
    ctx.fillRect(0, (height / 8) * i, width, 1);
  }
  ctx.fillStyle = gradient;
  const barWidth = width / data.length;
  data.forEach((value, index) => {
    const normalized = value / 255;
    const barHeight = Math.max(8, normalized * (height * 0.78));
    const x = index * barWidth;
    const y = height - barHeight - 28;
    roundedRect(ctx, x + 2, y, Math.max(3, barWidth - 4), barHeight, 10);
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

function makeId() {
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addToQueue(id) {
  if (!state.queue.includes(id)) state.queue.push(id);
  renderQueue();
}

function getRadioProxyUrl() {
  const configured = window.SHIYIN_RADIO_PROXY_URL || RADIO_PROXY_URL;
  return String(configured || "").trim().replace(/\/+$/, "");
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestAiTask(kind) {
  const proxyUrl = getRadioProxyUrl();
  const track = findTrack(state.currentId);
  if (!track) {
    els.aiOutput.textContent = "请先选择一个公开播客单集或电台节目。";
    return;
  }
  if (!proxyUrl) {
    els.aiOutput.textContent = "AI 功能需要先在 config.js 里配置你的 Deno 代理地址。";
    return;
  }

  const endpoint = kind === "summary" ? "/ai/summary" : "/ai/transcript";
  els.aiOutput.textContent = kind === "summary" ? "正在请求摘要..." : "正在请求转文字...";
  try {
    const response = await fetch(`${proxyUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: track.title,
        artist: track.artist,
        sourceUrl: track.sourceUrl,
        audioUrl: track.url,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `AI 请求失败：${response.status}`);
    els.aiOutput.textContent = data.text || data.summary || data.transcript || "没有返回内容。";
  } catch (error) {
    els.aiOutput.textContent = `${error.message || "AI 请求失败"}。`;
  }
}

function normalizeOpenTrack(track) {
  if (!track?.url) return null;
  return {
    id: track.id || `open-${makeId()}`,
    title: track.title || track.fileName || "Untitled",
    artist: track.artist || "Unknown creator",
    fileName: track.fileName || track.title || "Open audio",
    size: Number(track.size || 0),
    duration: Number(track.duration || 0),
    playable: true,
    remote: true,
    url: track.url,
    sourceName: track.sourceName || "Open audio",
    sourceUrl: track.sourceUrl || "",
    licenseUrl: track.licenseUrl || "",
    licenseLabel: track.licenseLabel || "Open license",
  };
}

async function searchPodcasts(query) {
  const term = query.trim();
  const proxyUrl = getRadioProxyUrl();
  if (!proxyUrl) throw new Error("播客搜索需要先配置 Deno 代理");
  const url = new URL(`${proxyUrl}/podcast/search`);
  url.searchParams.set("q", term || "科技播客");
  const data = await fetchJson(url);
  return Array.isArray(data?.podcasts) ? data.podcasts : [];
}

async function loadPodcastFeed(feedUrl) {
  const url = String(feedUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("请输入公开可访问的 RSS 链接");
  }

  els.openMusicQuery.value = url;
  els.openMusicStatus.textContent = "正在读取播客 RSS...";
  state.openResults = [];
  renderOpenMusic();
  const results = (await searchOpenMusic(url)).filter(Boolean);
  state.openResults = results;
  els.openMusicStatus.textContent = results.length ? `读取到 ${results.length} 个播客单集。` : "这个 RSS 暂时没有可播放单集。";
  renderOpenMusic();
}

async function searchOpenMusic(query) {
  const term = query.trim();
  const proxyUrl = getRadioProxyUrl();
  if (/^https?:\/\//i.test(term)) {
    if (!proxyUrl) {
      throw new Error("播客 RSS 需要先配置 Deno 代理，避免浏览器跨域限制");
    }
    const url = new URL(`${proxyUrl}/podcast/feed`);
    url.searchParams.set("url", term);
    const data = await fetchJson(url);
    const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
    return tracks.map(normalizeOpenTrack).filter(Boolean).slice(0, OPEN_MUSIC_RESULT_LIMIT);
  }

  if (proxyUrl) {
    try {
      const url = new URL(`${proxyUrl}/radio/search`);
      url.searchParams.set("q", getRadioQuery(term));
      const data = await fetchJson(url);
      const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
      return tracks.map(normalizeOpenTrack).filter(Boolean).slice(0, OPEN_MUSIC_RESULT_LIMIT);
    } catch (error) {
      console.warn("Radio proxy failed, falling back to direct public radio search.", error);
    }
  }

  const stations = await searchRadioStations(getRadioQuery(term));
  if (stations.length) return stations;

  return searchArchiveDirect(term);
}

function getRadioQuery(query) {
  const key = query.trim();
  return radioChannels[key]?.query || key || "中文";
}

async function searchRadioStations(query) {
  const term = toDomesticRadioQuery(query);
  const domesticTagged = await radioBrowserSearch({ countrycode: "CN", tag: term });
  const domesticNamed = await radioBrowserSearch({ countrycode: "CN", name: term });
  const chineseTagged = await radioBrowserSearch({ language: "chinese", tag: term });
  const chineseNamed = await radioBrowserSearch({ language: "chinese", name: term });
  const domesticFallback = domesticTagged.length + domesticNamed.length >= 4 ? [] : await radioBrowserSearch({ countrycode: "CN" });
  const seen = new Set();
  return [...domesticTagged, ...domesticNamed, ...chineseTagged, ...chineseNamed, ...domesticFallback]
    .map(createRadioTrack)
    .filter((track) => {
      if (!track || seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    })
    .slice(0, OPEN_MUSIC_RESULT_LIMIT);
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

async function radioBrowserSearch(params) {
  const url = new URL(`${RADIO_BROWSER_API_URL}/stations/search`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("hidebroken", "true");
  url.searchParams.set("limit", String(RADIO_STATION_LIMIT));
  url.searchParams.set("order", "clickcount");
  url.searchParams.set("reverse", "true");

  const stations = await fetchJson(url);
  return Array.isArray(stations) ? stations : [];
}

function createRadioTrack(station) {
  const streamUrl = station.url_resolved || station.url;
  const codec = String(station.codec || "").toLowerCase();
  if (!isPlayableRadioStream(streamUrl, codec)) return null;

  const country = [station.countrycode, station.language].filter(Boolean).join(" · ");
  const bitrate = Number(station.bitrate || 0);
  const meta = [codec.toUpperCase(), bitrate ? `${bitrate}kbps` : "", country].filter(Boolean).join(" · ");

  return {
    id: `radio-${station.stationuuid || makeId()}`,
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
    radioClickUrl: station.stationuuid ? `${RADIO_BROWSER_API_URL}/url/${station.stationuuid}` : "",
  };
}

function isPlayableRadioStream(url, codec) {
  if (!/^https?:\/\//i.test(String(url || ""))) return false;
  if (/\.(m3u|pls|asx)(?:$|\?)/i.test(url)) return false;
  if (/mpeg|mp3|aac|aacp|ogg|opus/.test(codec)) return true;
  return /\.(mp3|aac|ogg|oga|opus)(?:$|\?)/i.test(url);
}

async function searchArchiveDirect(term) {
  const textFilter = term ? ` AND (${term})` : "";
  const q = `mediatype:audio AND collection:opensource_audio AND licenseurl:*${textFilter}`;
  const url = new URL(ARCHIVE_SEARCH_URL);
  url.searchParams.set("q", q);
  ["identifier", "title", "creator", "licenseurl"].forEach((field) => url.searchParams.append("fl[]", field));
  url.searchParams.set("rows", "40");
  url.searchParams.set("page", "1");
  url.searchParams.set("output", "json");

  const data = await fetchJson(url);
  const docs = (data?.response?.docs || []).filter(hasSimpleOpenLicense).slice(0, OPEN_MUSIC_RESULT_LIMIT);
  return Promise.all(docs.map(createArchiveTrack));
}

async function tuneRadio(query, label = "") {
  els.openMusicQuery.value = query;
  els.radioTitle.textContent = label || radioChannels[query]?.title || `“${query}” 频道`;
  document.querySelectorAll("[data-radio-query]").forEach((button) => {
    button.classList.toggle("active", button.dataset.radioQuery === query);
  });
  els.openMusicStatus.textContent = /^https?:\/\//i.test(query) ? "正在读取播客 RSS..." : "正在调频公共电台...";
  els.openMusicResults.innerHTML = "";
  try {
    const results = (await searchOpenMusic(query)).filter(Boolean);
    state.openResults = results;
    els.openMusicStatus.textContent = results.length ? `调到 ${results.length} 个可尝试播放的节目源。若某个无法播放，请换一个。` : "这个频道暂时没有可播放节目源，换个频道或关键词试试。";
    renderOpenMusic();
  } catch (error) {
    els.openMusicStatus.textContent = `${error.message || "调频失败"}。你仍然可以使用本地音乐。`;
  }
}

function hasSimpleOpenLicense(doc) {
  const raw = Array.isArray(doc.licenseurl) ? doc.licenseurl[0] : doc.licenseurl || "";
  const license = raw.toLowerCase();
  return license.includes("creativecommons.org/publicdomain/zero/")
    || /creativecommons\.org\/licenses\/by\/(?:2\.0|2\.5|3\.0|4\.0)/.test(license);
}

async function createArchiveTrack(doc) {
  const identifier = doc.identifier;
  const metadataUrl = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const response = await fetch(metadataUrl);
  if (!response.ok) throw new Error(`读取元数据失败：${identifier}`);
  const data = await response.json();
  const files = data?.files || [];
  const file = files.find((item) => /\.mp3$/i.test(item.name || "") && /mp3|vbr/i.test(item.format || ""))
    || files.find((item) => /\.(ogg|opus|webm)$/i.test(item.name || ""))
    || files.find((item) => /\.mp3$/i.test(item.name || ""));
  if (!file) return null;

  const title = Array.isArray(doc.title) ? doc.title[0] : doc.title || identifier;
  const creator = Array.isArray(doc.creator) ? doc.creator[0] : doc.creator || "Unknown creator";
  const licenseUrl = Array.isArray(doc.licenseurl) ? doc.licenseurl[0] : doc.licenseurl || "";
  const licenseLabel = licenseUrl.includes("publicdomain/zero") ? "CC0" : "CC BY";
  const encodedName = file.name.split("/").map(encodeURIComponent).join("/");

  return {
    id: `ia-${identifier}`,
    title,
    artist: creator,
    fileName: file.name,
    size: Number(file.size || 0),
    duration: 0,
    playable: true,
    remote: true,
    url: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodedName}`,
    sourceName: `Internet Archive · ${licenseLabel}`,
    sourceUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    licenseUrl,
    licenseLabel,
  };
}

function addToPlaylist(id) {
  if (!state.playlists.length) {
    const name = prompt("输入新歌单名称", "我的歌单");
    if (!name) return;
    state.playlists.push({ id: makeId(), name: name.trim(), trackIds: [] });
  }

  const names = state.playlists.map((playlist, index) => `${index + 1}. ${playlist.name}`).join("\n");
  const answer = prompt(`选择歌单编号：\n${names}`, "1");
  const index = Number(answer) - 1;
  const playlist = state.playlists[index];
  if (!playlist) return;
  if (!playlist.trackIds.includes(id)) playlist.trackIds.push(id);
  saveJson("lumaCrate.playlists", state.playlists);
  renderPlaylists();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-jump-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.jumpView));
});

els.fileInput.addEventListener("change", () => {
  const files = Array.from(els.fileInput.files || []);
  const importedTracks = files.map(makeTrack);
  state.tracks.push(...importedTracks);
  state.queue = state.queue.filter((id) => findTrack(id));
  render();
  const firstPlayable = importedTracks.find((track) => track.playable);
  if (!state.currentId && firstPlayable) playTrack(firstPlayable.id);
  if (files.length && !firstPlayable) {
    showPlayerMessage("没有可播放的标准音频。请导入 mp3、flac、wav、m4a、ogg 等格式。");
  }
  els.fileInput.value = "";
});

els.trackList.addEventListener("click", (event) => {
  const row = event.target.closest(".track-row");
  if (!row) return;
  const action = event.target.closest("button")?.dataset.action || "play";
  if (action === "play") playTrack(row.dataset.id);
  if (action === "queue") addToQueue(row.dataset.id);
  if (action === "playlist") addToPlaylist(row.dataset.id);
});

els.queueList.addEventListener("click", (event) => {
  const row = event.target.closest(".track-row");
  if (!row) return;
  const action = event.target.closest("button")?.dataset.action || "play";
  if (action === "play") playTrack(row.dataset.id);
  if (action === "queue") {
    state.queue = state.queue.filter((id) => id !== row.dataset.id);
    renderQueue();
  }
  if (action === "playlist") addToPlaylist(row.dataset.id);
  if (action === "source") window.open(findTrack(row.dataset.id)?.sourceUrl, "_blank", "noopener,noreferrer");
});

els.openMusicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = els.openMusicQuery.value.trim();
  if (!query) return;
  state.podcastResults = [];
  renderPodcastResults();
  try {
    if (/^https?:\/\//i.test(query)) {
      await loadPodcastFeed(query);
      return;
    }
    els.openMusicStatus.textContent = "正在搜索公开播客目录...";
    const podcasts = await searchPodcasts(query);
    state.podcastResults = podcasts;
    state.openResults = [];
    els.openMusicStatus.textContent = podcasts.length ? `找到 ${podcasts.length} 个播客。点击“单集”读取 RSS。` : "没有找到相关播客，换个关键词试试。";
    renderPodcastResults();
    renderOpenMusic();
  } catch (error) {
    els.openMusicStatus.textContent = `${error.message || "播客搜索失败"}。你也可以切换到电台搜索。`;
  }
});

els.radioSearchBtn.addEventListener("click", () => {
  tuneRadio(els.openMusicQuery.value.trim() || "中文");
});

document.querySelectorAll("[data-podcast-query]").forEach((button) => {
  button.addEventListener("click", async () => {
    els.openMusicQuery.value = button.dataset.podcastQuery;
    els.openMusicForm.requestSubmit();
  });
});

document.querySelectorAll("[data-radio-query]").forEach((button) => {
  button.addEventListener("click", () => tuneRadio(button.dataset.radioQuery, button.textContent.trim()));
});

els.radioShuffleBtn.addEventListener("click", () => {
  const channels = Array.from(document.querySelectorAll("[data-radio-query]"));
  const channel = channels[Math.floor(Math.random() * channels.length)];
  if (channel) tuneRadio(channel.dataset.radioQuery, channel.textContent.trim());
});

els.podcastResults.addEventListener("click", async (event) => {
  const card = event.target.closest(".podcast-card");
  if (!card) return;
  const action = event.target.closest("button")?.dataset.action || "episodes";
  if (action === "source") {
    const sourceUrl = card.dataset.sourceUrl;
    if (sourceUrl) window.open(sourceUrl, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    await loadPodcastFeed(card.dataset.feedUrl);
  } catch (error) {
    els.openMusicStatus.textContent = `${error.message || "读取 RSS 失败"}。`;
  }
});

els.openMusicResults.addEventListener("click", (event) => {
  const row = event.target.closest(".track-row");
  if (!row) return;
  const action = event.target.closest("button")?.dataset.action || "play";
  if (action === "play") playTrack(row.dataset.id);
  if (action === "queue") addToQueue(row.dataset.id);
  if (action === "source") window.open(findTrack(row.dataset.id)?.sourceUrl, "_blank", "noopener,noreferrer");
});

els.playlistForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.playlistName.value.trim();
  if (!name) return;
  state.playlists.push({ id: makeId(), name, trackIds: [] });
  els.playlistName.value = "";
  saveJson("lumaCrate.playlists", state.playlists);
  renderPlaylists();
});

els.playlistGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".playlist-card");
  const action = event.target.closest("button")?.dataset.action;
  if (!card || !action) return;
  const playlist = state.playlists.find((item) => item.id === card.dataset.id);
  if (!playlist) return;
  if (action === "play-playlist") {
    state.queue = playlist.trackIds.filter((id) => state.tracks.some((track) => track.id === id));
    if (state.queue[0]) playTrack(state.queue[0]);
    setView("queue");
  }
  if (action === "delete-playlist" && confirm(`删除歌单“${playlist.name}”？`)) {
    state.playlists = state.playlists.filter((item) => item.id !== playlist.id);
    saveJson("lumaCrate.playlists", state.playlists);
    renderPlaylists();
  }
});

els.saveLyricsBtn.addEventListener("click", () => {
  if (!state.currentId) return;
  state.lyrics[state.currentId] = els.lyricsInput.value;
  saveJson("lumaCrate.lyrics", state.lyrics);
  renderLyrics();
});

els.aiSummaryBtn.addEventListener("click", () => requestAiTask("summary"));
els.aiTranscriptBtn.addEventListener("click", () => requestAiTask("transcript"));

els.clearLibraryBtn.addEventListener("click", () => {
  if (!confirm("清空当前浏览器里的本地曲库列表？文件本身不会被删除。")) return;
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls.clear();
  state.tracks = [];
  state.queue = [];
  state.currentId = null;
  els.audio.removeAttribute("src");
  els.audio.load();
  render();
});

els.clearQueueBtn.addEventListener("click", () => {
  state.queue = [];
  renderQueue();
});

els.searchInput.addEventListener("input", renderTracks);
els.playBtn.addEventListener("click", togglePlay);
els.prevBtn.addEventListener("click", () => move(-1));
els.nextBtn.addEventListener("click", () => move(1));

els.shuffleBtn.addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  updateNowPlaying();
});

els.focusModeBtn.addEventListener("click", () => {
  document.body.classList.toggle("stage-mode");
  updateNowPlaying();
});

els.themeToggleBtn.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = state.theme;
  localStorage.setItem("lumaCrate.theme", state.theme);
  updateNowPlaying();
});

document.querySelectorAll(".mood-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.mood = button.dataset.mood;
    document.body.dataset.mood = state.mood;
    localStorage.setItem("lumaCrate.mood", state.mood);
    renderStudio();
  });
});

els.buildMixBtn.addEventListener("click", () => {
  const ids = [...state.tracks.map((track) => track.id)];
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.queue = ids.slice(0, Math.min(18, ids.length));
  if (state.queue[0]) playTrack(state.queue[0]);
  render();
  setView("queue");
});

els.repeatBtn.addEventListener("click", () => {
  state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  updateNowPlaying();
});

els.volume.addEventListener("input", () => {
  els.audio.volume = Number(els.volume.value);
  localStorage.setItem("lumaCrate.volume", String(els.audio.volume));
});

els.progress.addEventListener("input", () => {
  if (!Number.isFinite(els.audio.duration)) return;
  els.audio.currentTime = (Number(els.progress.value) / 1000) * els.audio.duration;
});

els.audio.addEventListener("play", updateNowPlaying);
els.audio.addEventListener("play", () => {
  if (state.audioContext?.state === "suspended") state.audioContext.resume();
});
els.audio.addEventListener("pause", updateNowPlaying);

els.audio.addEventListener("loadedmetadata", () => {
  const track = state.tracks.find((item) => item.id === state.currentId);
  if (track) track.duration = els.audio.duration;
  els.duration.textContent = formatTime(els.audio.duration);
  renderTracks();
  renderQueue();
});

els.audio.addEventListener("error", () => {
  const error = els.audio.error;
  const track = findTrack(state.currentId);
  if (markRemoteTrackFailed(track)) return;
  const reason = error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
    ? "浏览器不支持这个音频格式。"
    : "音频加载失败。";
  showPlayerMessage(`${reason} 请使用 mp3、flac、wav、m4a、ogg 等标准格式。`);
});

els.audio.addEventListener("timeupdate", () => {
  const duration = els.audio.duration || 0;
  els.currentTime.textContent = formatTime(els.audio.currentTime);
  els.duration.textContent = formatTime(duration);
  els.progress.value = duration ? String(Math.round((els.audio.currentTime / duration) * 1000)) : "0";
  renderLyrics();
});

els.audio.addEventListener("ended", () => {
  if (state.repeat === "one") {
    els.audio.currentTime = 0;
    els.audio.play().catch(() => {});
    return;
  }
  if (state.repeat === "all" || state.queue.length > 1) move(1);
});

render();
