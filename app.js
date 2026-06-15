const els = {
  audio: document.querySelector("#audio"),
  fileInput: document.querySelector("#fileInput"),
  searchInput: document.querySelector("#searchInput"),
  trackList: document.querySelector("#trackList"),
  queueList: document.querySelector("#queueList"),
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
  clearLibraryBtn: document.querySelector("#clearLibraryBtn"),
  clearQueueBtn: document.querySelector("#clearQueueBtn"),
  nowTitle: document.querySelector("#nowTitle"),
  nowArtist: document.querySelector("#nowArtist"),
  playBtn: document.querySelector("#playBtn"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  repeatBtn: document.querySelector("#repeatBtn"),
  focusModeBtn: document.querySelector("#focusModeBtn"),
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
  playlists: document.querySelector("#playlistsView"),
  lyrics: document.querySelector("#lyricsView"),
  about: document.querySelector("#aboutView"),
};

const state = {
  tracks: [],
  queue: [],
  playlists: loadJson("echoShelf.playlists", []),
  lyrics: loadJson("echoShelf.lyrics", {}),
  currentId: null,
  objectUrls: new Map(),
  shuffle: false,
  repeat: "off",
  activeView: "library",
  mood: localStorage.getItem("echoShelf.mood") || "default",
  visualizerReady: false,
  audioContext: null,
  analyser: null,
  source: null,
  animationId: null,
};

document.body.dataset.mood = state.mood;
els.audio.volume = Number(localStorage.getItem("echoShelf.volume") || "0.85");
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
  };
}

function getUrl(track) {
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
    playlists: "歌单",
    lyrics: "歌词",
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
  renderStudio();
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
  const queuedTracks = state.queue.map((id) => state.tracks.find((track) => track.id === id)).filter(Boolean);
  if (!queuedTracks.length) {
    els.queueList.innerHTML = `<div class="empty-state">播放队列为空。</div>`;
    return;
  }

  els.queueList.innerHTML = queuedTracks.map((track, index) => trackRow(track, index, "queue")).join("");
}

function trackRow(track, index, context) {
  const isPlaying = state.currentId === track.id;
  return `
    <article class="track-row ${isPlaying ? "playing" : ""}" data-id="${track.id}" data-context="${context}">
      <div class="track-index">${isPlaying ? "▶" : index + 1}</div>
      <div class="track-main">
        <strong>${escapeHtml(track.title)}</strong>
        <span>${escapeHtml(track.fileName)}</span>
      </div>
      <div class="track-meta">${escapeHtml(track.artist)}</div>
      <div class="track-duration">${track.duration ? formatTime(track.duration) : formatSize(track.size)}</div>
      <div class="row-actions">
        <button class="icon-button" data-action="play" title="播放" aria-label="播放">▶</button>
        <button class="icon-button" data-action="queue" title="加入队列" aria-label="加入队列">+</button>
        <button class="icon-button" data-action="playlist" title="加入歌单" aria-label="加入歌单">≡</button>
      </div>
    </article>
  `;
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

function playTrack(id) {
  const track = state.tracks.find((item) => item.id === id);
  if (!track) return;

  state.currentId = id;
  if (!state.queue.includes(id)) state.queue.push(id);
  els.audio.src = getUrl(track);
  setupVisualizer();
  els.audio.play().catch(() => {});
  render();
}

function togglePlay() {
  if (!state.currentId && state.tracks[0]) {
    playTrack(state.tracks[0].id);
    return;
  }
  if (els.audio.paused) {
    els.audio.play().catch(() => {});
  } else {
    els.audio.pause();
  }
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
  const track = state.tracks.find((item) => item.id === state.currentId);
  els.nowTitle.textContent = track?.title || "未选择歌曲";
  els.nowArtist.textContent = track?.artist || "导入本地音频开始播放";
  els.playBtn.textContent = els.audio.paused ? "▶" : "Ⅱ";
  els.shuffleBtn.classList.toggle("shuffle-on", state.shuffle);
  els.repeatBtn.classList.toggle("repeat-on", state.repeat !== "off");
  els.repeatBtn.textContent = state.repeat === "one" ? "①" : "↻";
  els.focusModeBtn.classList.toggle("repeat-on", document.body.classList.contains("stage-mode"));
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
  saveJson("echoShelf.playlists", state.playlists);
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

els.fileInput.addEventListener("change", () => {
  const files = Array.from(els.fileInput.files || []);
  const audioFiles = files.filter((file) => file.type.startsWith("audio/"));
  state.tracks.push(...audioFiles.map(makeTrack));
  state.queue = state.queue.filter((id) => state.tracks.some((track) => track.id === id));
  render();
  if (!state.currentId && state.tracks[0]) playTrack(state.tracks[0].id);
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
});

els.playlistForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.playlistName.value.trim();
  if (!name) return;
  state.playlists.push({ id: makeId(), name, trackIds: [] });
  els.playlistName.value = "";
  saveJson("echoShelf.playlists", state.playlists);
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
    saveJson("echoShelf.playlists", state.playlists);
    renderPlaylists();
  }
});

els.saveLyricsBtn.addEventListener("click", () => {
  if (!state.currentId) return;
  state.lyrics[state.currentId] = els.lyricsInput.value;
  saveJson("echoShelf.lyrics", state.lyrics);
  renderLyrics();
});

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

document.querySelectorAll(".mood-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.mood = button.dataset.mood;
    document.body.dataset.mood = state.mood;
    localStorage.setItem("echoShelf.mood", state.mood);
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
  localStorage.setItem("echoShelf.volume", String(els.audio.volume));
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
