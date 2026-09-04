const STORAGE_KEY = "ergo-thumb-v1";
const DAILY_GOAL_MIN = 3;
const DAILY_GOAL_MAX = 4;
const REST_MS = 1600;

const EXERCISES = [
  {
    id: 1,
    title: "Thumb into the palm",
    original: "Étirer le pouce dans la paume (avec la main droite)",
    detail:
      "Push on the left thumb with the right index finger so every thumb joint bends in toward the left palm, then hold.",
    hold: 10,
    repsMin: 5,
    repsMax: 10,
    type: "hold",
    figure: "palm",
  },
  {
    id: 2,
    title: "Thumb to each finger",
    original:
      "Toucher chaque doigt avec le pouce, glisser le pouce sur le petit doigt",
    detail:
      "Touch the thumb to index, middle, ring, then pinky. After the pinky tap, slide the thumb down the little finger. That whole pass is one repetition.",
    hold: null,
    repsMin: 10,
    repsMax: 15,
    type: "sequence",
    sequence: [
      "Touch the index finger",
      "Touch the middle finger",
      "Touch the ring finger",
      "Touch the pinky",
      "Slide the thumb down the pinky",
    ],
    figure: "fingers",
  },
  {
    id: 3,
    title: "Thumb in an L",
    original:
      "Avec la main à plat, étirer le pouce en « L » (avec la main droite)",
    detail:
      "Rest the hand flat. Use the right hand to open the thumb out into an L, then hold.",
    hold: 10,
    repsMin: 5,
    repsMax: 10,
    type: "hold",
    figure: "ell",
  },
  {
    id: 4,
    title: "Clothespin pinch",
    original: "Avec le pouce et l’index, pincer une pince à linge",
    detail: "Pinch a clothespin between the thumb and index finger, then hold.",
    hold: 4,
    holdChoices: [3, 4, 5],
    holdLabel: "3–5 seconds",
    repsMin: 10,
    repsMax: 15,
    type: "hold",
    figure: "pinch",
  },
  {
    id: 5,
    title: "Squeeze a ball",
    original: "Serrer une balle",
    detail: "Squeeze a soft ball in the palm and keep the pressure.",
    hold: 4,
    holdChoices: [3, 4, 5],
    holdLabel: "3–5 seconds",
    repsMin: 10,
    repsMax: 15,
    type: "hold",
    figure: "ball",
  },
];

const FIGURES = {
  palm: `<img src="./figures/thumb-into-palm.jpg" alt="Right index finger pressing on the tip of the left thumb, folding it into the palm">`,
  fingers: `<img src="./figures/thumb-to-fingers.jpg" alt="Thumb touching the index fingertip">`,
  ell: `<img src="./figures/thumb-in-l.jpg" alt="Hand flat with the thumb stretched out into an L">`,
  pinch: `<img src="./figures/clothespin-pinch.jpg" alt="Thumb and index finger pinching a clothespin">`,
  ball: `<img src="./figures/squeeze-ball.jpg" alt="Hand squeezing a soft therapy ball">`,
};

const todayKey = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: todayKey(), sessions: 0, sound: true };
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), sessions: 0, sound: parsed.sound !== false };
    }
    return {
      date: parsed.date,
      sessions: Number(parsed.sessions) || 0,
      sound: parsed.sound !== false,
    };
  } catch {
    return { date: todayKey(), sessions: 0, sound: true };
  }
};

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const app = document.querySelector("#app");

const session = {
  view: "home",
  exerciseIndex: 0,
  reps: 0,
  holdSeconds: 10,
  phase: "idle",
  remainingMs: 0,
  sequenceStep: 0,
  persist: loadState(),
};

let timerId = 0;
let restId = 0;
let audioCtx = null;

const stopTimers = () => {
  window.clearInterval(timerId);
  window.clearTimeout(restId);
  timerId = 0;
  restId = 0;
};

const currentExercise = () => EXERCISES[session.exerciseIndex];

const unlockAudio = () => {
  if (!session.persist.sound) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {
    /* ignore */
  }
};

const chime = (kind = "done") => {
  if (!session.persist.sound) return;
  try {
    unlockAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = kind === "done" ? 660 : 520;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.24);
    if (navigator.vibrate) navigator.vibrate(kind === "done" ? 40 : 18);
  } catch {
    /* ignore locked audio contexts */
  }
};

const canAdvance = () => {
  const exercise = currentExercise();
  return session.reps >= exercise.repsMin;
};

const atTarget = () => {
  const exercise = currentExercise();
  return session.reps >= exercise.repsMax;
};

const resetExercise = (index = session.exerciseIndex) => {
  const exercise = EXERCISES[index];
  session.exerciseIndex = index;
  session.reps = 0;
  session.phase = "idle";
  session.sequenceStep = 0;
  session.holdSeconds = exercise.hold || 0;
  session.remainingMs = session.holdSeconds * 1000;
  stopTimers();
};

const completeSession = () => {
  const today = todayKey();
  if (session.persist.date !== today) {
    session.persist.sessions = 0;
    session.persist.date = today;
  }
  session.persist.sessions += 1;
  saveState(session.persist);
  session.view = "done";
  stopTimers();
  render();
};

const goHome = () => {
  stopTimers();
  session.view = "home";
  render();
};

const startSession = () => {
  resetExercise(0);
  session.view = "exercise";
  render();
};

const countRep = () => {
  session.reps += 1;
  chime("done");
  if (atTarget() && session.exerciseIndex === EXERCISES.length - 1) {
    completeSession();
    return;
  }
  if (atTarget()) {
    session.phase = "complete";
    render();
    return;
  }
  session.phase = "rest";
  session.sequenceStep = 0;
  render();
  restId = window.setTimeout(() => {
    session.phase = "idle";
    session.remainingMs = session.holdSeconds * 1000;
    render();
  }, REST_MS);
};

const startHold = () => {
  const exercise = currentExercise();
  if (exercise.type !== "hold" || session.phase === "running") return;
  session.phase = "running";
  session.remainingMs = session.holdSeconds * 1000;
  const started = performance.now();
  render();
  timerId = window.setInterval(() => {
    const elapsed = performance.now() - started;
    session.remainingMs = Math.max(0, session.holdSeconds * 1000 - elapsed);
    if (session.remainingMs <= 0) {
      stopTimers();
      countRep();
      return;
    }
    updateTimerDom();
  }, 50);
};

const markSequenceStep = () => {
  const exercise = currentExercise();
  if (exercise.type !== "sequence") return;
  if (session.sequenceStep < exercise.sequence.length - 1) {
    session.sequenceStep += 1;
    chime("step");
    render();
    return;
  }
  countRep();
};

const setHold = (seconds) => {
  if (session.phase === "running") return;
  session.holdSeconds = seconds;
  session.remainingMs = seconds * 1000;
  render();
};

const nextExercise = () => {
  if (!canAdvance()) return;
  if (session.exerciseIndex >= EXERCISES.length - 1) {
    completeSession();
    return;
  }
  resetExercise(session.exerciseIndex + 1);
  session.view = "exercise";
  render();
};

const prevExercise = () => {
  if (session.exerciseIndex === 0) {
    goHome();
    return;
  }
  resetExercise(session.exerciseIndex - 1);
  render();
};

const toggleSound = () => {
  session.persist.sound = !session.persist.sound;
  if (session.persist.sound) unlockAudio();
  saveState(session.persist);
  render();
};

const formatSeconds = (ms) => (Math.ceil(ms / 1000) || 0).toString();

const ringOffset = (ms, total) => {
  const circumference = 2 * Math.PI * 74;
  const progress = total <= 0 ? 0 : Math.max(0, Math.min(1, ms / total));
  return circumference * (1 - progress);
};

const updateTimerDom = () => {
  const value = app.querySelector("[data-timer-value]");
  const ring = app.querySelector("[data-timer-ring]");
  if (value) value.textContent = formatSeconds(session.remainingMs);
  if (ring) {
    ring.style.strokeDashoffset = String(
      ringOffset(session.remainingMs, session.holdSeconds * 1000)
    );
  }
};

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const renderHome = () => {
  const { sessions } = session.persist;
  const dots = Array.from({ length: DAILY_GOAL_MAX }, (_, index) => {
    const done = index < sessions;
    const goal = index === DAILY_GOAL_MIN - 1;
    return `<div class="session-dot${done ? " done" : ""}${goal ? " goal" : ""}">${index + 1}</div>`;
  }).join("");

  const items = EXERCISES.map((exercise) => {
    const timing = exercise.hold
      ? `${exercise.holdLabel || `${exercise.hold}s`} · ${exercise.repsMin}–${exercise.repsMax}×`
      : `${exercise.repsMin}–${exercise.repsMax}×`;
    return `
      <div class="plan-item">
        <div class="plan-num">${exercise.id}</div>
        <div>
          <strong>${escapeHtml(exercise.title)}</strong>
          <span>${escapeHtml(exercise.original)}</span>
          <div class="plan-meta">${escapeHtml(timing)}</div>
        </div>
      </div>`;
  }).join("");

  return `
    <section class="screen screen-home">
      <div>
        <p class="kicker">Thumb ergotherapy</p>
        <h1>Five exercises, three to four times a day.</h1>
      </div>
      <div class="screen-body">
      <div class="card">
        <div class="row">
          <div>
            <p class="kicker">Today</p>
            <p class="lede">${sessions} of ${DAILY_GOAL_MIN}–${DAILY_GOAL_MAX} sessions</p>
          </div>
        </div>
        <div class="sessions" aria-label="Daily sessions">${dots}</div>
      </div>
      <div class="card plan">${items}</div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-action="start">Start a session</button>
        <button class="btn btn-ghost" data-action="sound">${
          session.persist.sound ? "Sound on" : "Sound off"
        }</button>
      </div>
    </section>`;
};

const renderSequence = (exercise) => {
  const steps = exercise.sequence
    .map((label, index) => {
      const state =
        index < session.sequenceStep
          ? "done"
          : index === session.sequenceStep
            ? "active"
            : "";
      return `<div class="step ${state}"><span class="dot"></span>${escapeHtml(label)}</div>`;
    })
    .join("");
  return `<div class="sequence" aria-live="polite">${steps}</div>`;
};

const renderTimer = (exercise) => {
  const total = session.holdSeconds * 1000;
  const circumference = 2 * Math.PI * 74;
  const offset = ringOffset(session.remainingMs || total, total);
  const choices = (exercise.holdChoices || [])
    .map(
      (value) =>
        `<button class="chip${session.holdSeconds === value ? " active" : ""}" data-action="hold" data-seconds="${value}">${value}s</button>`
    )
    .join("");

  return `
    ${
      choices
        ? `<div class="row"><span class="lede">Hold time</span><div class="chips">${choices}</div></div>`
        : ""
    }
    <div class="timer-wrap">
      <svg class="timer-ring" viewBox="0 0 168 168" aria-hidden="true">
        <circle class="track" cx="84" cy="84" r="74"></circle>
        <circle class="value" data-timer-ring cx="84" cy="84" r="74"
          stroke-dasharray="${circumference.toFixed(2)}"
          style="stroke-dashoffset:${offset}"></circle>
      </svg>
      <div class="timer-readout">
        <div>
          <strong data-timer-value>${formatSeconds(session.remainingMs || total)}</strong>
          <span>seconds</span>
        </div>
      </div>
    </div>`;
};

const phaseLabel = (exercise) => {
  if (session.phase === "running") return "Hold…";
  if (session.phase === "rest") return "Rest, then go again.";
  if (session.phase === "complete") return "That exercise is done.";
  if (canAdvance()) return "Minimum reached. Keep going or move on.";
  if (exercise.type === "sequence") return "Do each step, then tap next.";
  return "Get set, then start the hold.";
};

const renderExercise = () => {
  const exercise = currentExercise();
  const index = session.exerciseIndex;
  const progress = ((index + (session.reps / exercise.repsMax)) / EXERCISES.length) * 100;
  const primaryDisabled =
    session.phase === "running" ||
    session.phase === "rest" ||
    (session.phase === "complete" && !canAdvance());
  const nextDisabled = !canAdvance();
  const lastExercise = index === EXERCISES.length - 1;
  const primaryLabel =
    session.phase === "complete"
      ? lastExercise
        ? "Finish session"
        : "Next exercise"
      : exercise.type === "sequence"
        ? session.sequenceStep === exercise.sequence.length - 1
          ? "Finish this repetition"
          : "Next step"
        : session.phase === "running"
          ? "Holding…"
          : "Start hold";

  return `
    <section class="screen screen-exercise">
      <div class="topbar">
        <button class="icon-btn" data-action="back">Back</button>
        <p class="kicker">Exercise ${index + 1} of ${EXERCISES.length}</p>
        <button class="icon-btn" data-action="sound">${
          session.persist.sound ? "Sound" : "Muted"
        }</button>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="screen-body">
      <div>
        <h2>${escapeHtml(exercise.title)}</h2>
        <p class="quote">${escapeHtml(exercise.original)}</p>
      </div>
      <p class="lede">${escapeHtml(exercise.detail)}</p>
      ${
        exercise.type === "hold"
          ? `<div class="figure">${FIGURES[exercise.figure]}</div>${renderTimer(exercise)}`
          : `<div class="figure figure-compact">${FIGURES[exercise.figure]}</div>${renderSequence(exercise)}`
      }
      </div>
      <div class="reps">
        <div>
          <div class="count">${session.reps}</div>
          <div class="range">${exercise.repsMin}–${exercise.repsMax} repetitions</div>
        </div>
        <p class="status ${session.phase}" aria-live="polite">${phaseLabel(exercise)}</p>
      </div>
      <div class="actions">
        <button class="btn ${
          session.phase === "complete"
            ? "btn-good"
            : exercise.type === "hold"
              ? "btn-hold"
              : "btn-primary"
        }" data-action="primary" ${primaryDisabled ? "disabled" : ""}>${primaryLabel}</button>
        <div class="btn-row">
          <button class="btn btn-ghost" data-action="skip-rep" ${
            session.phase === "running" ||
            session.phase === "rest" ||
            session.phase === "complete"
              ? "disabled"
              : ""
          }>Count this rep</button>
          <button class="btn btn-ghost" data-action="next" ${
            nextDisabled ? "disabled" : ""
          }>${lastExercise ? "Finish session" : "Next exercise"}</button>
        </div>
      </div>
    </section>`;
};

const renderDone = () => {
  const { sessions } = session.persist;
  const message =
    sessions >= DAILY_GOAL_MAX
      ? "Daily plan complete. You can stop here, or add another session later if it feels good."
      : sessions >= DAILY_GOAL_MIN
        ? "Daily minimum is done. One more session would finish the 3–4 range."
        : `${DAILY_GOAL_MIN - sessions} more session${DAILY_GOAL_MIN - sessions === 1 ? "" : "s"} to reach today’s minimum.`;

  return `
    <section class="screen">
      <div class="done-mark" aria-hidden="true">✓</div>
      <div>
        <p class="kicker">Session ${sessions} today</p>
        <h1>That’s the full set.</h1>
      </div>
      <p class="lede">${escapeHtml(message)}</p>
      <div class="card">
        <div class="sessions" aria-label="Daily sessions">
          ${Array.from({ length: DAILY_GOAL_MAX }, (_, index) => {
            const done = index < sessions;
            return `<div class="session-dot${done ? " done" : ""}">${index + 1}</div>`;
          }).join("")}
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-action="home">Back to the plan</button>
        <button class="btn btn-ghost" data-action="start">Do another session</button>
      </div>
    </section>`;
};

const render = () => {
  if (session.view === "home") app.innerHTML = renderHome();
  else if (session.view === "done") app.innerHTML = renderDone();
  else app.innerHTML = renderExercise();
};

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "start") {
    unlockAudio();
    startSession();
  }
  if (action === "home") goHome();
  if (action === "back") prevExercise();
  if (action === "sound") toggleSound();
  if (action === "primary") {
    unlockAudio();
    if (session.phase === "complete") {
      nextExercise();
      return;
    }
    const exercise = currentExercise();
    if (exercise.type === "hold") startHold();
    else markSequenceStep();
  }
  if (action === "hold") setHold(Number(target.dataset.seconds));
  if (action === "skip-rep") {
    if (session.phase !== "running") countRep();
  }
  if (action === "next") nextExercise();
});

render();
