const app = document.querySelector("#app");

const fallbackSongs = [
  createDemoSong(1, "songs/Demo Track", "Neon Beat Stage", 90, 2, 4, {
    title: "\u9b3c\u6ec5\u4e4b\u5203-\u7d05\u84ee\u83ef",
    coverPng: "songs/Demo Track/01.png",
    previewMp3: "songs/Demo Track/01.mp3",
    gameplayMp4: "songs/Demo Track/01.mp4",
  }),
  createDemoSong(2, "songs/Demo Track 02", "Pulse Alley", 30, 1, 3, {
    title: "\u5409\u4f0a\u5361\u54c7\u5287\u5834\u7248 \u4eba\u9b5a\u5cf6\u7684\u79d8\u5bc6 \u70cf\u85a9\u5947RAP",
    coverPng: "songs/Demo Track 02/cover.png",
    previewMp3: "songs/Demo Track 02/02.mp3",
    gameplayMp4: "songs/Demo Track 02/02.mp4",
  }),
  createDemoSong(3, "songs/Demo Track 03", "Chrome Voltage", 32, 2, 4, {
    coverPng: "",
    previewMp3: "",
    gameplayMp4: "",
  }),
  createDemoSong(4, "songs/Demo Track 04", "Arc Light", 34, 3, 5, {
    coverPng: "",
    previewMp3: "",
    gameplayMp4: "",
  }),
  createDemoSong(5, "songs/Demo Track 05", "Signal Riot", 36, 2, 5, {
    coverPng: "",
    previewMp3: "",
    gameplayMp4: "",
  }),
];

const arrows = {
  left: "\u2190",
  down: "\u2193",
  up: "\u2191",
  right: "\u2192",
};

const keyToDirection = {
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowUp: "up",
  ArrowRight: "right",
};

const laneOrder = ["left", "down", "up", "right"];
const speedOptions = [1, 2, 3];
const assetVersion = "20260910-track02-cover-rgb";
const menuBgmScreens = new Set(["home", "select", "difficulty"]);
const menuItems = [
  { label: "\u6b4c\u66f2\u9078\u55ae", icon: "\u266b", action: "select" },
  { label: "\u96e2\u958b", icon: "\u23fb", action: "exit" },
];

const state = {
  screen: "home",
  songs: [],
  selectedMenu: 0,
  selectedSong: 0,
  selectedDifficulty: "easy",
  selectedSpeed: 1,
  selectedPauseAction: 0,
  game: null,
  songMoving: false,
};

let rafId = 0;
let songMoveTimer = 0;
let audioContext = null;
let menuBgm = null;
let menuBgmWanted = false;
let menuBgmAttempt = 0;
let audioUnlocked = false;
let menuBgmSynthSource = null;
let menuBgmSynthGain = null;
let menuBgmSynthBuffer = null;
let songPreview = null;
let songPreviewAttempt = 0;
const swipeSfx = new Map();
const pressedDirections = new Set();

init();

function createDemoSong(number, folder, artist, duration, easyStars, hardStars, media = {}) {
  const padded = String(number).padStart(2, "0");
  const fallbackCover = `${folder}/cover.svg`;
  const cover = media.coverPng || fallbackCover;
  const video = media.gameplayMp4 || "";
  return {
    id: `demo-track-${padded}`,
    title: media.title || `Demo Track ${padded}`,
    artist,
    folder,
    media: {
      coverPng: media.coverPng || "",
      previewMp3: media.previewMp3 || "",
      gameplayMp4: media.gameplayMp4 || "",
    },
    cover,
    video,
    preview: media.previewMp3 || video,
    duration,
    difficulties: {
      easy: {
        label: "\u7c21\u55ae",
        stars: easyStars,
        chart: `${folder}/chart_easy.json`,
      },
      hard: {
        label: "\u56f0\u96e3",
        stars: hardStars,
        chart: `${folder}/chart_hard.json`,
      },
    },
  };
}

async function init() {
  state.songs = await loadSongs();
  renderHome();
  window.addEventListener("pointerdown", unlockMenuAudio);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
}

async function loadSongs() {
  try {
    const response = await fetch("songs/index.json", { cache: "no-store" });
    if (!response.ok) throw new Error("songs/index.json missing");
    const data = await response.json();
    return Array.isArray(data.songs) && data.songs.length ? data.songs.map(normalizeSongMetadata) : fallbackSongs.map(normalizeSongMetadata);
  } catch {
    return fallbackSongs.map(normalizeSongMetadata);
  }
}

function normalizeSongMetadata(song) {
  const media = song.media || {};
  const cover = media.coverPng || media.coverFallback || song.cover || `${song.folder}/cover.svg`;
  const video = media.gameplayMp4 || song.video || "";
  const preview = media.previewMp3 || song.preview || song.audio || video;
  return {
    ...song,
    media,
    cover,
    video,
    preview,
    previewStart: Number(media.previewStart ?? song.previewStart ?? 0),
  };
}

function renderHome() {
  stopGameLoop();
  clearSongMoveTimer();
  stopSongPreview();
  state.screen = "home";
  startMenuBgm();
  state.selectedMenu = wrapIndex(state.selectedMenu, menuItems.length);

  app.innerHTML = `
    <section class="screen home-screen">
      <div class="brand-block">
        <p class="kicker">Cyberpunk Rhythm Game</p>
        <h1 class="title">Neon<br />Beat<br />Stage</h1>
        <p class="subtitle">\u9713\u8679\u821e\u53f0\u5df2\u4eae\uff0c\u7bc0\u62cd\u6b63\u5728\u7b49\u5019\u3002</p>
      </div>
      <div class="menu-list" role="menu">
        ${menuItems
          .map(
            (item, index) => `
              <button class="menu-button ${index === state.selectedMenu ? "is-selected" : ""}" data-menu="${index}">
                <span class="menu-icon" aria-hidden="true">${item.icon}</span>
                <span class="menu-label">${item.label}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;

  app.querySelectorAll("[data-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMenu = Number(button.dataset.menu);
      confirmAction(activateHomeMenu);
    });
  });
}

function activateHomeMenu() {
  const selected = menuItems[state.selectedMenu];
  if (selected.action === "exit") {
    stopMenuBgm();
    stopSongPreview();
    app.innerHTML = `
      <section class="screen home-screen">
        <div class="brand-block">
          <p class="kicker">Neon Beat Stage</p>
          <h1 class="title">See<br />You</h1>
          <p class="subtitle">\u8996\u7a97\u53ef\u4ee5\u76f4\u63a5\u95dc\u9589\u3002</p>
        </div>
      </section>
    `;
    return;
  }
  renderSongSelect();
}

function renderSongSelect() {
  stopGameLoop();
  clearSongMoveTimer();
  state.songMoving = false;
  state.screen = "select";
  stopMenuBgm();
  if (!state.songs.length) {
    stopSongPreview();
    app.innerHTML = `<section class="screen select-screen"><p class="empty">\u5c1a\u672a\u627e\u5230\u6b4c\u66f2\u3002</p></section>`;
    return;
  }

  const song = state.songs[state.selectedSong];
  const albumCards = getVisibleSongs()
    .map(
      ({ song: item, slot }) => `
        <div class="album" data-slot="${slot}">
          <img src="${escapeHtml(versionedAsset(item.cover))}" alt="${escapeHtml(item.title)} \u5c08\u8f2f\u5c01\u9762" />
        </div>
      `,
    )
    .join("");

  app.innerHTML = `
    <section class="screen select-screen">
      <header class="top-bar">
        <h2 class="screen-heading">\u9078\u6b4c</h2>
        <span>${state.selectedSong + 1} / ${state.songs.length}</span>
      </header>
      <div class="carousel">
        <button class="nav-button" data-nav="-1" aria-label="\u4e0a\u4e00\u9996">\u2039</button>
        <div class="album-stage">${albumCards}</div>
        <button class="nav-button" data-nav="1" aria-label="\u4e0b\u4e00\u9996">\u203a</button>
      </div>
      <footer class="song-meta">
        <div>
          <h3 class="song-title">${escapeHtml(song.title)}</h3>
          <p class="artist">${escapeHtml(song.artist || "Unknown Artist")}</p>
        </div>
        <span class="pill">${escapeHtml(song.difficulties?.easy?.label || "\u7c21\u55ae")} / ${escapeHtml(song.difficulties?.hard?.label || "\u56f0\u96e3")}</span>
      </footer>
    </section>
  `;

  app.querySelectorAll("[data-nav]").forEach((button) => {
    const nav = (event) => {
      event.preventDefault();
      event.stopPropagation();
      requestSongMove(Number(button.dataset.nav));
    };
    button.addEventListener("pointerdown", nav);
    button.addEventListener("click", nav);
  });

  startSongPreview(song);
}

function renderDifficulty() {
  clearSongMoveTimer();
  stopSongPreview();
  state.screen = "difficulty";
  startMenuBgm();
  const song = state.songs[state.selectedSong];
  const difficulties = Object.entries(song.difficulties || fallbackSongs[0].difficulties);
  state.selectedSpeed = speedOptions.includes(state.selectedSpeed) ? state.selectedSpeed : 1;

  app.innerHTML = `
    <section class="screen difficulty-screen">
      <header class="top-bar">
        <h2 class="screen-heading">${escapeHtml(song.title)}</h2>
        <span>${escapeHtml(song.artist || "Unknown Artist")}</span>
      </header>
      <div class="difficulty-setup">
        <section class="setup-section">
          <div class="setup-label">\u96e3\u5ea6</div>
          <div class="difficulty-grid">
            ${difficulties
              .map(([key, diff]) => {
                const selected = key === state.selectedDifficulty ? "is-selected" : "";
                return `
                  <button class="difficulty-card ${selected}" data-difficulty="${key}">
                    <h3 class="difficulty-name">${escapeHtml(diff.label || key)}</h3>
                    <div class="stars">${renderStars(diff.stars || 1)}</div>
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
        <section class="setup-section speed-section">
          <div class="setup-label">\u901f\u5ea6</div>
          <div class="speed-grid">
            ${speedOptions
              .map((speed) => {
                const selected = speed === state.selectedSpeed ? "is-selected" : "";
                return `
                  <button class="speed-card ${selected}" data-speed="${speed}">
                    <span>${speed}</span>
                    <small>x</small>
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
      </div>
      <footer class="difficulty-meta">
        <span class="pill">${escapeHtml(song.title)}</span>
        <span class="pill">\u901f\u5ea6 ${state.selectedSpeed}x</span>
      </footer>
    </section>
  `;

  app.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDifficulty = button.dataset.difficulty;
      renderDifficulty();
    });
    button.addEventListener("dblclick", () => confirmAction(startGame));
  });

  app.querySelectorAll("[data-speed]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSpeed = Number(button.dataset.speed);
      renderDifficulty();
    });
    button.addEventListener("dblclick", () => confirmAction(startGame));
  });
}

async function startGame() {
  stopGameLoop();
  clearSongMoveTimer();
  stopMenuBgm();
  stopSongPreview();
  pressedDirections.clear();
  state.screen = "play";
  const song = state.songs[state.selectedSong];
  const difficulty = song.difficulties[state.selectedDifficulty];
  const chart = await loadChart(song, difficulty);
  const duration = Number(song.duration || chart.duration || 45);
  const speed = speedOptions.includes(state.selectedSpeed) ? state.selectedSpeed : 1;

  app.innerHTML = `
    <section class="screen play-screen">
      <video class="video-bg" playsinline></video>
      <div class="fallback-bg" aria-hidden="true"></div>
      <div class="play-overlay">
        <div class="hud">
          <div>0</div>
          <div class="hud-center">${escapeHtml(difficulty.label || state.selectedDifficulty)} / ${speed}x</div>
          <div class="hud-right">COMBO 0</div>
        </div>
        <div class="combo-meter" aria-live="polite">
          <span data-combo-value>0</span>
          <small>COMBO</small>
        </div>
        <div class="lane-wrap">
          <div class="lanes">${laneOrder.map(() => `<div class="lane"></div>`).join("")}</div>
          <div class="judgement"></div>
        </div>
        <div class="receptors">
          ${laneOrder.map((direction) => `<div class="receptor" data-receptor="${direction}">${arrows[direction]}</div>`).join("")}
        </div>
      </div>
      <div class="pause-panel" hidden>
        <div class="pause-box">
          <h2>\u66ab\u505c</h2>
          <button class="action-button primary" data-pause-action="resume" data-pause-index="0">\u7e7c\u7e8c</button>
          <button class="action-button" data-pause-action="select" data-pause-index="1">\u56de\u9078\u6b4c</button>
        </div>
      </div>
      <div class="media-start-panel" hidden>
        <div class="media-start-box">
          <h2>READY</h2>
          <button class="action-button primary" data-media-action="start">ENTER</button>
        </div>
      </div>
    </section>
  `;

  const video = app.querySelector("video");
  const fallback = app.querySelector(".fallback-bg");
  const hasVideo = Boolean(song.video);

  state.game = {
    song,
    difficulty,
    speed,
    duration,
    notes: chart.notes
      .filter((note) => laneOrder.includes(note.direction))
      .map((note, index) => ({
        id: index,
        time: Number(note.time),
        direction: note.direction,
        hold: Math.max(0, Number(note.hold || note.duration || 0)),
        holding: false,
        hit: false,
        missed: false,
        element: null,
      })),
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    startedAt: performance.now(),
    video,
    fallback,
    judgedAt: 0,
    paused: false,
    pausedAt: 0,
    waitingForPlayback: false,
    timelineStarted: false,
  };

  app.querySelectorAll("[data-pause-action]").forEach((button) => {
    button.addEventListener("mouseenter", () => {
      state.selectedPauseAction = Number(button.dataset.pauseIndex);
      updatePauseSelection();
    });
    button.addEventListener("click", () => confirmAction(() => activatePauseAction(button.dataset.pauseAction)));
  });
  app.querySelector("[data-media-action='start']").addEventListener("click", () => confirmAction(startTimeline));

  if (hasVideo) {
    video.src = song.video;
    video.addEventListener("error", () => {
      video.removeAttribute("src");
      fallback.style.display = "block";
      hideMediaStartPanel();
      startFallbackTimeline();
    });
    video.addEventListener("ended", finishGame);
    await startTimeline();
  } else {
    startFallbackTimeline();
  }
}

async function loadChart(song, difficulty) {
  if (difficulty?.chart) {
    try {
      const response = await fetch(difficulty.chart, { cache: "no-store" });
      if (!response.ok) throw new Error("chart missing");
      return await response.json();
    } catch {
      return generateChart(song.duration || 42, state.selectedDifficulty);
    }
  }
  return generateChart(song.duration || 42, state.selectedDifficulty);
}

function generateChart(duration, mode) {
  const step = mode === "hard" ? 0.48 : 0.82;
  const start = 1.6;
  const notes = [];
  for (let time = start; time < duration - 1.2; time += step) {
    const direction = laneOrder[Math.floor((time * 10) % laneOrder.length)];
    const roundedTime = Number(time.toFixed(2));
    const note = { time: roundedTime, direction };
    if ((mode === "hard" && notes.length % 11 === 0) || (mode !== "hard" && notes.length % 14 === 0)) {
      note.hold = mode === "hard" ? 0.9 : 0.7;
    }
    notes.push(note);
    if ((mode === "hard" && notes.length % 7 === 0) || (mode !== "hard" && notes.length % 10 === 0)) {
      notes.push({ time: roundedTime, direction: laneOrder[(laneOrder.indexOf(direction) + 2) % laneOrder.length] });
    }
  }
  return { duration, notes };
}

function updateGame() {
  const game = state.game;
  if (!game || game.paused || !game.timelineStarted) return;

  const now = getSongTime(game);
  const laneWrap = app.querySelector(".lane-wrap");
  const laneRect = laneWrap.getBoundingClientRect();
  const travelTime = 2.15 / game.speed;

  game.notes.forEach((note) => {
    const target = getReceptorMetrics(note.direction, laneRect);
    const noteEndTime = note.time + note.hold;
    const timeUntilHit = note.time - now;
    const startY = -70;
    const distance = target.centerY - startY;
    const y = target.centerY - timeUntilHit * (distance / travelTime);
    const tailY = target.centerY - (noteEndTime - now) * (distance / travelTime);
    const missY = target.bottomY + 40;

    if (note.holding) {
      if (!pressedDirections.has(note.direction)) {
        failNote(note);
        showJudgement("MISS");
        updateHud(game);
        return;
      }

      if (!note.element) {
        note.element = createNoteElement(note);
        laneWrap.appendChild(note.element);
      }
      positionNoteElement(note, target.centerX, target.centerY, Math.max(0, target.centerY - tailY));

      if (now >= noteEndTime - 0.05) {
        completeNote(note, 1200);
        showJudgement("HOLD");
        updateHud(game);
      }
      return;
    }

    if (!note.hit && !note.missed && y > missY) {
      failNote(note);
      removeNote(note);
      showJudgement("MISS");
      updateHud(game);
      return;
    }

    if (note.hit || note.missed || y < -90 || y > missY) {
      return;
    }

    if (!note.element) {
      note.element = createNoteElement(note);
      laneWrap.appendChild(note.element);
    }

    positionNoteElement(note, target.centerX, y, Math.max(0, y - tailY));
  });

  updateHud(game);

  if (now >= game.duration || game.notes.every((note) => note.hit || note.missed)) {
    finishGame();
    return;
  }

  rafId = requestAnimationFrame(updateGame);
}

function handleDirection(direction) {
  const game = state.game;
  if (!game || game.paused) return;

  flashReceptor(direction);
  const candidates = game.notes
    .filter((note) => note.direction === direction && !note.hit && !note.missed && isNoteInJudgeZone(note, direction))
    .map((note) => ({ note, distance: getNoteJudgeDistance(note, direction) }))
    .sort((a, b) => a.distance - b.distance);

  const best = candidates[0];
  if (!best) {
    return;
  }

  if (best.note.hold > 0) {
    best.note.holding = true;
    best.note.element?.classList.add("is-holding");
    showJudgement("HOLD");
    updateHud(game);
    return;
  }

  completeNote(best.note, 1000);
  showJudgement("1000");
  updateHud(game);
}

function createNoteElement(note) {
  const element = document.createElement("div");
  element.className = note.hold > 0 ? "note hold-note" : "note";
  if (note.hold > 0) {
    element.innerHTML = `
      <span class="hold-trail" aria-hidden="true"></span>
      <span class="hold-head">${arrows[note.direction]}</span>
    `;
  } else {
    element.textContent = arrows[note.direction];
  }
  return element;
}

function positionNoteElement(note, x, y, holdHeight = 0) {
  if (!note.element) return;
  note.element.style.left = `${x}px`;
  note.element.style.top = `${y}px`;
  if (note.hold > 0) {
    note.element.style.setProperty("--hold-height", `${Math.max(18, holdHeight)}px`);
  }
}

function completeNote(note, score) {
  const game = state.game;
  if (!game || note.hit || note.missed) return;
  note.hit = true;
  note.holding = false;
  removeNote(note);
  game.score += score;
  game.combo += 1;
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  game.hits += 1;
}

function failNote(note) {
  const game = state.game;
  if (!game || note.hit || note.missed) return;
  note.missed = true;
  note.holding = false;
  game.combo = 0;
  game.misses += 1;
  removeNote(note);
}

function releaseHeldNotes(direction) {
  const game = state.game;
  if (!game || game.paused || game.waitingForPlayback) return;
  const now = getSongTime(game);
  game.notes
    .filter((note) => note.direction === direction && note.holding && !note.hit && !note.missed)
    .forEach((note) => {
      if (now >= note.time + note.hold - 0.14) {
        completeNote(note, 1200);
        showJudgement("HOLD");
      } else {
        failNote(note);
        showJudgement("MISS");
      }
    });
  updateHud(game);
}

function finishGame() {
  const game = state.game;
  if (!game) return;
  stopGameLoop();
  if (game.video) {
    game.video.pause();
    game.video.removeAttribute("src");
  }
  const result = {
    score: game.score,
    hits: game.hits,
    misses: game.misses,
    maxCombo: game.maxCombo,
    total: game.notes.length,
  };
  state.game = null;
  renderResult(result);
}

function renderResult(result) {
  state.screen = "result";
  const accuracy = result.total ? result.hits / result.total : 0;
  const rank = accuracy >= 0.95 ? "S" : accuracy >= 0.82 ? "A" : accuracy >= 0.65 ? "B" : "C";

  app.innerHTML = `
    <section class="screen result-screen">
      <header class="top-bar">
        <h2 class="screen-heading">\u7d50\u7b97</h2>
        <span>${Math.round(accuracy * 100)}%</span>
      </header>
      <div class="result-body">
        <div class="rank">${rank}</div>
        <div class="stats">
          <div class="stat"><div class="stat-label">SCORE</div><div class="stat-value">${result.score}</div></div>
          <div class="stat"><div class="stat-label">HIT</div><div class="stat-value">${result.hits}</div></div>
          <div class="stat"><div class="stat-label">MISS</div><div class="stat-value">${result.misses}</div></div>
          <div class="stat"><div class="stat-label">MAX COMBO</div><div class="stat-value">${result.maxCombo}</div></div>
        </div>
      </div>
      <footer class="footer-actions">
        <button class="action-button" data-action="select">\u56de\u9078\u6b4c</button>
        <button class="action-button primary" data-action="retry">\u91cd\u65b0\u904a\u73a9</button>
      </footer>
    </section>
  `;

  app.querySelector("[data-action='select']").addEventListener("click", () => confirmAction(renderSongSelect));
  app.querySelector("[data-action='retry']").addEventListener("click", () => confirmAction(startGame));
}

function handleKeyDown(event) {
  unlockMenuAudio();

  if (event.key in keyToDirection) {
    event.preventDefault();
    pressedDirections.add(keyToDirection[event.key]);
  }

  if (state.screen === "home") {
    if (event.key === "ArrowLeft") {
      state.selectedMenu = wrapIndex(state.selectedMenu - 1, menuItems.length);
      renderHome();
    }
    if (event.key === "ArrowRight") {
      state.selectedMenu = wrapIndex(state.selectedMenu + 1, menuItems.length);
      renderHome();
    }
    if (event.key === "Enter") confirmAction(activateHomeMenu);
    return;
  }

  if (state.screen === "select") {
    if (event.key === "ArrowLeft") requestSongMove(-1);
    if (event.key === "ArrowRight") requestSongMove(1);
    if (event.key === "Enter") confirmAction(renderDifficulty);
    if (event.key === "Escape") renderHome();
    return;
  }

  if (state.screen === "difficulty") {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") toggleDifficulty();
    if (event.key === "ArrowUp") toggleSpeed(1);
    if (event.key === "ArrowDown") toggleSpeed(-1);
    if (event.key === "Enter") confirmAction(startGame);
    if (event.key === "Escape") renderSongSelect();
    return;
  }

  if (state.screen === "play" && keyToDirection[event.key]) {
    if (state.game?.paused) {
      handlePauseKeyDown(event);
      return;
    }
    if (state.game?.waitingForPlayback) return;
    if (!event.repeat) {
      handleDirection(keyToDirection[event.key]);
    }
    return;
  }

  if (state.screen === "play" && state.game?.paused) {
    handlePauseKeyDown(event);
    return;
  }

  if (state.screen === "play" && event.key === "Enter" && state.game?.waitingForPlayback) {
    confirmAction(startTimeline);
    return;
  }

  if (state.screen === "play" && event.key === "Escape") {
    togglePause();
    return;
  }

  if (state.screen === "result") {
    if (event.key === "Enter") confirmAction(startGame);
    if (event.key === "Escape") renderSongSelect();
  }
}

function handleKeyUp(event) {
  if (keyToDirection[event.key]) {
    const direction = keyToDirection[event.key];
    pressedDirections.delete(direction);
    releaseHeldNotes(direction);
    const receptor = app.querySelector(`[data-receptor="${direction}"]`);
    receptor?.classList.remove("is-pressed");
  }
}

function requestSongMove(offset) {
  if (state.screen !== "select" || state.songMoving || state.songs.length <= 1) return;

  const direction = offset > 0 ? 1 : -1;
  playDeckSwipeSound(direction);
  moveSong(direction);
}

function moveSong(offset) {
  if (state.screen !== "select" || state.songMoving || state.songs.length <= 1) return;

  const direction = offset > 0 ? 1 : -1;
  const screen = app.querySelector(".select-screen");
  if (!screen) return;

  state.songMoving = true;
  screen.classList.add(direction > 0 ? "is-moving-next" : "is-moving-prev");

  songMoveTimer = window.setTimeout(() => {
    state.selectedSong = wrapIndex(state.selectedSong + direction, state.songs.length);
    const difficulties = Object.keys(state.songs[state.selectedSong].difficulties || {});
    state.selectedDifficulty = difficulties.includes(state.selectedDifficulty) ? state.selectedDifficulty : difficulties[0] || "easy";
    state.songMoving = false;
    renderSongSelect();
  }, 280);
}

function toggleDifficulty() {
  const song = state.songs[state.selectedSong];
  const keys = Object.keys(song.difficulties || {});
  const current = keys.indexOf(state.selectedDifficulty);
  state.selectedDifficulty = keys[wrapIndex(current + 1, keys.length)] || "easy";
  renderDifficulty();
}

function toggleSpeed(offset) {
  const current = speedOptions.indexOf(state.selectedSpeed);
  state.selectedSpeed = speedOptions[wrapIndex(current + offset, speedOptions.length)] || 1;
  renderDifficulty();
}

function getVisibleSongs() {
  const slots = [-2, -1, 0, 1, 2];
  return slots.map((slot) => ({
    slot,
    song: state.songs[wrapIndex(state.selectedSong + slot, state.songs.length)],
  }));
}

function getReceptorMetrics(direction, laneRect) {
  const receptor = app.querySelector(`[data-receptor="${direction}"]`);
  const receptorRect = receptor.getBoundingClientRect();
  return {
    centerX: receptorRect.left + receptorRect.width / 2 - laneRect.left,
    centerY: receptorRect.top + receptorRect.height / 2 - laneRect.top,
    topY: receptorRect.top - laneRect.top,
    bottomY: receptorRect.bottom - laneRect.top,
  };
}

function isNoteInJudgeZone(note, direction) {
  if (!note.element) return false;
  const receptor = app.querySelector(`[data-receptor="${direction}"]`);
  if (!receptor) return false;
  const noteRect = note.element.getBoundingClientRect();
  const receptorRect = receptor.getBoundingClientRect();
  return (
    noteRect.bottom >= receptorRect.top &&
    noteRect.top <= receptorRect.bottom &&
    noteRect.right >= receptorRect.left &&
    noteRect.left <= receptorRect.right
  );
}

function getNoteJudgeDistance(note, direction) {
  const receptor = app.querySelector(`[data-receptor="${direction}"]`);
  const noteRect = note.element.getBoundingClientRect();
  const receptorRect = receptor.getBoundingClientRect();
  const noteCenter = noteRect.top + noteRect.height / 2;
  const receptorCenter = receptorRect.top + receptorRect.height / 2;
  return Math.abs(noteCenter - receptorCenter);
}

function getSongTime(game) {
  if (game.video && game.video.readyState > 0 && !game.video.paused) {
    return game.video.currentTime;
  }
  return (performance.now() - game.startedAt) / 1000;
}

async function startTimeline() {
  const game = state.game;
  if (!game || game.timelineStarted) return;

  game.waitingForPlayback = false;
  hideMediaStartPanel();

  if (game.video && game.video.getAttribute("src")) {
    try {
      await game.video.play();
      game.fallback.style.display = "none";
      game.startedAt = performance.now() - game.video.currentTime * 1000;
      game.timelineStarted = true;
      rafId = requestAnimationFrame(updateGame);
      return;
    } catch {
      game.waitingForPlayback = true;
      showMediaStartPanel();
      return;
    }
  }

  startFallbackTimeline();
}

function startFallbackTimeline() {
  const game = state.game;
  if (!game || game.timelineStarted) return;
  game.waitingForPlayback = false;
  game.timelineStarted = true;
  game.startedAt = performance.now();
  hideMediaStartPanel();
  game.fallback.style.display = "block";
  rafId = requestAnimationFrame(updateGame);
}

function showMediaStartPanel() {
  const panel = app.querySelector(".media-start-panel");
  if (panel) panel.hidden = false;
}

function hideMediaStartPanel() {
  const panel = app.querySelector(".media-start-panel");
  if (panel) panel.hidden = true;
}

function updateHud(game) {
  const hud = app.querySelector(".hud");
  if (!hud) return;
  hud.children[0].textContent = String(game.score);
  hud.children[2].textContent = `COMBO ${game.combo}`;
  const comboValue = app.querySelector("[data-combo-value]");
  if (comboValue) comboValue.textContent = String(game.combo);
}

function showJudgement(text) {
  const judgement = app.querySelector(".judgement");
  const game = state.game;
  if (!judgement || !game) return;
  judgement.textContent = text;
  judgement.classList.add("is-visible");
  game.judgedAt += 1;
  const token = game.judgedAt;
  window.setTimeout(() => {
    if (state.game?.judgedAt === token) judgement.classList.remove("is-visible");
  }, 180);
}

function flashReceptor(direction) {
  const receptor = app.querySelector(`[data-receptor="${direction}"]`);
  receptor?.classList.add("is-pressed");
}

function handlePauseKeyDown(event) {
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    event.preventDefault();
    state.selectedPauseAction = wrapIndex(state.selectedPauseAction - 1, 2);
    updatePauseSelection();
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    event.preventDefault();
    state.selectedPauseAction = wrapIndex(state.selectedPauseAction + 1, 2);
    updatePauseSelection();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const action = state.selectedPauseAction === 0 ? "resume" : "select";
    confirmAction(() => activatePauseAction(action));
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    resumeGame();
  }
}

function activatePauseAction(action) {
  if (action === "resume") {
    resumeGame();
    return;
  }

  if (action === "select") {
    stopGameLoop();
    if (state.game?.video) state.game.video.pause();
    state.game = null;
    pressedDirections.clear();
    renderSongSelect();
  }
}

function updatePauseSelection() {
  app.querySelectorAll("[data-pause-action]").forEach((button) => {
    button.classList.toggle("primary", Number(button.dataset.pauseIndex) === state.selectedPauseAction);
  });
}

function confirmAction(action) {
  playConfirmBass();
  return action();
}

function unlockMenuAudio() {
  audioUnlocked = true;
  if (menuBgmScreens.has(state.screen) && menuBgmWanted) {
    startMenuBgm();
  }
  if (state.screen === "select") {
    startSongPreview(state.songs[state.selectedSong]);
  }
}

function startSongPreview(song) {
  const source = getSongPreviewSource(song);
  songPreviewAttempt += 1;
  const attempt = songPreviewAttempt;

  if (!source) {
    stopSongPreview();
    return;
  }

  try {
    document.documentElement.dataset.songPreviewSource = source;
    if (!songPreview) {
      songPreview = document.createElement("audio");
      songPreview.loop = true;
      songPreview.preload = "auto";
      songPreview.volume = 0.42;
    }

    if (songPreview.dataset.source !== source) {
      songPreview.pause();
      songPreview.src = source;
      songPreview.dataset.source = source;
      songPreview.currentTime = Number(song.previewStart || 0);
    }

    if (!audioUnlocked && songPreview.paused) return;

    const playPromise = songPreview.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        if (songPreviewAttempt === attempt && audioUnlocked) {
          document.documentElement.dataset.songPreviewState = "blocked";
        }
      });
    }
    document.documentElement.dataset.songPreviewState = "playing";
  } catch {
    stopSongPreview();
    document.documentElement.dataset.songPreviewState = "unavailable";
  }
}

function stopSongPreview() {
  songPreviewAttempt += 1;
  document.documentElement.dataset.songPreviewState = "stopped";
  document.documentElement.dataset.songPreviewSource = "";
  if (!songPreview) return;
  songPreview.pause();
  songPreview.removeAttribute("src");
  songPreview.dataset.source = "";
  songPreview.load();
}

function getSongPreviewSource(song) {
  if (!song) return "";
  return song.preview || song.audio || song.video || "";
}

function startMenuBgm() {
  menuBgmWanted = true;
  document.documentElement.dataset.menuBgmWanted = "true";

  try {
    if (!menuBgm) {
      menuBgm = document.createElement("audio");
      menuBgm.src = "assets/sfx/menu-nightclub-loop.wav";
      menuBgm.loop = true;
      menuBgm.preload = "auto";
      menuBgm.volume = 0.28;
    }

    if (!menuBgm.paused) {
      stopMenuBgmSynth();
      document.documentElement.dataset.menuBgmState = "playing";
      return;
    }

    const attempt = (menuBgmAttempt += 1);
    const playPromise = menuBgm.play();
    if (playPromise?.catch) {
      playPromise
        .then(() => {
          if (menuBgmAttempt === attempt) {
            stopMenuBgmSynth();
            document.documentElement.dataset.menuBgmState = "playing";
          }
        })
        .catch(() => {
          if (menuBgmAttempt === attempt) {
            if (audioUnlocked) {
              startMenuBgmSynth();
            } else {
              document.documentElement.dataset.menuBgmState = "blocked";
            }
          }
        });
    }
  } catch {
    menuBgm = null;
    document.documentElement.dataset.menuBgmState = "unavailable";
  }
}

function stopMenuBgm() {
  menuBgmWanted = false;
  menuBgmAttempt += 1;
  document.documentElement.dataset.menuBgmWanted = "false";
  document.documentElement.dataset.menuBgmState = "stopped";
  stopMenuBgmSynth();
  if (!menuBgm) return;
  menuBgm.pause();
  menuBgm.currentTime = 0;
}

function startMenuBgmSynth() {
  if (menuBgmSynthSource || !menuBgmWanted) return;

  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    menuBgmSynthBuffer ||= createMenuBgmSynthBuffer(audioContext);

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = menuBgmSynthBuffer;
    source.loop = true;
    gain.gain.value = 0.18;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start();

    menuBgmSynthSource = source;
    menuBgmSynthGain = gain;
    const resumePromise = audioContext.resume();
    if (resumePromise?.catch) resumePromise.catch(() => {});
    document.documentElement.dataset.menuBgmState = "synth";
  } catch {
    stopMenuBgmSynth();
    document.documentElement.dataset.menuBgmState = "blocked";
  }
}

function stopMenuBgmSynth() {
  if (!menuBgmSynthSource) return;
  try {
    menuBgmSynthSource.stop();
    menuBgmSynthSource.disconnect();
    menuBgmSynthGain?.disconnect();
  } catch {
  }
  menuBgmSynthSource = null;
  menuBgmSynthGain = null;
}

function createMenuBgmSynthBuffer(context) {
  const duration = 8;
  const total = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, total, context.sampleRate);
  const data = buffer.getChannelData(0);
  const bpm = 120;
  const beat = 60 / bpm;
  const eighth = beat / 2;
  const bassNotes = [41.2, 41.2, 49, 41.2, 73.42, 65.41, 61.74, 49];
  const chordRoots = [82.41, 98, 73.42, 110];

  for (let index = 0; index < total; index += 1) {
    const time = index / context.sampleRate;
    const beatPhase = time % beat;
    const eighthPhase = time % eighth;
    const step = Math.floor(time / eighth);
    const bassFreq = bassNotes[step % bassNotes.length];
    const bassEnv = Math.min(1, eighthPhase / 0.012) * Math.exp(-eighthPhase * 3.2);
    const bass =
      Math.sin(2 * Math.PI * bassFreq * time) +
      0.42 * Math.sin(2 * Math.PI * bassFreq * 2 * time + 0.4) +
      0.22 * Math.sin(2 * Math.PI * bassFreq * 3 * time + 1.1);
    let value = Math.tanh(bass * 2.3) * bassEnv * 0.3;
    value += Math.sin(2 * Math.PI * (bassFreq / 2) * time) * bassEnv * 0.22;

    const root = chordRoots[Math.floor(time / 2) % chordRoots.length];
    const guitarEnv = Math.min(1, eighthPhase / 0.006) * Math.exp(-eighthPhase * (step % 2 ? 5.2 : 7));
    let chord = 0;
    [1, 1.5, 2, 3].forEach((multiple, harmonic) => {
      const phase = root * multiple * time;
      const saw = 2 * (phase - Math.floor(phase + 0.5));
      chord += saw * [0.9, 0.7, 0.55, 0.2][harmonic];
    });
    value += Math.tanh(chord * 2) * guitarEnv * 0.16;

    if (beatPhase < 0.18) {
      const kickFreq = 42 + 88 * Math.exp(-beatPhase * 24);
      value += Math.sin(2 * Math.PI * kickFreq * time) * Math.exp(-beatPhase * 9.5) * 0.58;
    }

    const ghostKickPhase = beatPhase - beat * 0.72;
    const beatIndex = Math.floor(time / beat);
    if ((beatIndex % 4 === 0 || beatIndex % 4 === 2) && ghostKickPhase >= 0 && ghostKickPhase < 0.13) {
      const kickFreq = 42 + 72 * Math.exp(-ghostKickPhase * 24);
      value += Math.sin(2 * Math.PI * kickFreq * time) * Math.exp(-ghostKickPhase * 12) * 0.34;
    }

    if ((beatIndex % 4 === 1 || beatIndex % 4 === 3) && beatPhase < 0.18) {
      const rawNoise = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
      const noise = (rawNoise - Math.floor(rawNoise)) * 2 - 1;
      value += Math.sin(2 * Math.PI * 185 * time) * Math.exp(-beatPhase * 13) * 0.22;
      value += noise * Math.exp(-beatPhase * 19) * 0.12;
    }

    if (eighthPhase < 0.05) {
      const rawNoise = Math.sin(index * 17.312) * 9821.123;
      const noise = (rawNoise - Math.floor(rawNoise)) * 2 - 1;
      value += noise * Math.exp(-eighthPhase * 52) * (step % 2 ? 0.04 : 0.06);
    }

    const fade = Math.min(1, index / (context.sampleRate * 0.04), (total - index - 1) / (context.sampleRate * 0.04));
    data[index] = Math.tanh(value * 1.18) * fade * 0.7;
  }

  return buffer;
}

function playConfirmBass() {
  document.documentElement.dataset.lastConfirmBassAt = String(Date.now());

  const audio = getUiAudio("assets/sfx/confirm-bass.wav", 0.82);
  if (audio) {
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(playConfirmBassTone);
    }
    return;
  }

  playConfirmBassTone();
}

function playDeckSwipeSound(direction) {
  window.__lastSwipeSoundAt = performance.now();
  window.__lastSwipeSoundDirection = direction;
  document.documentElement.dataset.lastSwipeSoundDirection = String(direction);
  document.documentElement.dataset.lastSwipeSoundAt = String(Date.now());

  const sfxPath = direction > 0 ? "assets/sfx/scratch-right.wav" : "assets/sfx/scratch-left.wav";
  const audio = getUiAudio(sfxPath, 0.55);
  if (audio) {
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(() => playDeckSwipeTone(direction));
    }
    return;
  }

  playDeckSwipeTone(direction);
}

function getUiAudio(path, volume) {
  try {
    if (!swipeSfx.has(path)) {
      const audio = document.createElement("audio");
      audio.src = path;
      audio.preload = "auto";
      audio.volume = volume;
      swipeSfx.set(path, audio);
    }
    const audio = swipeSfx.get(path).cloneNode(true);
    audio.volume = volume;
    return audio;
  } catch {
    return null;
  }
}

function playConfirmBassTone() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(118, now);
    oscillator.frequency.exponentialRampToValueAtTime(42, now + 0.42);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.58, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.52);
  } catch {
    audioContext = null;
  }
}

function playDeckSwipeTone(direction) {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    const now = audioContext.currentTime;
    const duration = 0.16;
    const bufferSize = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      const fade = 1 - index / bufferSize;
      data[index] = (Math.random() * 2 - 1) * fade;
    }

    const noise = audioContext.createBufferSource();
    const noiseGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const tone = audioContext.createOscillator();
    const toneGain = audioContext.createGain();

    noise.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(direction > 0 ? 760 : 1180, now);
    filter.frequency.exponentialRampToValueAtTime(direction > 0 ? 1680 : 520, now + duration);
    filter.Q.value = 7;
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.18, now + 0.018);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    tone.type = "sawtooth";
    tone.frequency.setValueAtTime(direction > 0 ? 220 : 330, now);
    tone.frequency.exponentialRampToValueAtTime(direction > 0 ? 420 : 170, now + duration);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    tone.connect(toneGain);
    toneGain.connect(audioContext.destination);

    noise.start(now);
    noise.stop(now + duration);
    tone.start(now);
    tone.stop(now + duration);
  } catch {
    audioContext = null;
  }
}

function togglePause() {
  const game = state.game;
  if (!game) return;
  if (game.paused) {
    resumeGame();
    return;
  }
  game.paused = true;
  game.pausedAt = performance.now();
  state.selectedPauseAction = 0;
  game.video?.pause();
  stopGameLoop();
  app.querySelector(".pause-panel").hidden = false;
  updatePauseSelection();
}

function resumeGame() {
  const game = state.game;
  if (!game) return;
  if (game.pausedAt && (!game.video || game.video.paused)) {
    game.startedAt += performance.now() - game.pausedAt;
  }
  game.paused = false;
  game.pausedAt = 0;
  app.querySelector(".pause-panel").hidden = true;
  game.video?.play().catch(() => {});
  rafId = requestAnimationFrame(updateGame);
}

function removeNote(note) {
  note.element?.remove();
  note.element = null;
}

function stopGameLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

function clearSongMoveTimer() {
  if (songMoveTimer) {
    window.clearTimeout(songMoveTimer);
    songMoveTimer = 0;
  }
}

function wrapIndex(index, length) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

function renderStars(count) {
  const filled = Math.max(1, Math.min(5, Number(count) || 1));
  return "\u2605".repeat(filled) + "\u2606".repeat(5 - filled);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function versionedAsset(path) {
  if (!path) return "";
  const separator = String(path).includes("?") ? "&" : "?";
  return `${path}${separator}v=${assetVersion}`;
}
