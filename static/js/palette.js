const totalRounds = 3;

const roundNumberElement = document.getElementById("round-number");
const totalScoreElement = document.getElementById("total-score");
const paletteStatusElement = document.getElementById("palette-status");
const targetColorCard = document.getElementById("target-color-card");
const countdownElement = document.getElementById("countdown");

const liveColorStage = document.getElementById("live-color-stage");
const liveStageHex = document.getElementById("live-stage-hex");

const controlsPanel = document.getElementById("controls-panel");
const guessPanel = document.getElementById("guess-panel");
const finalScreen = document.getElementById("final-screen");

const hueSlider = document.getElementById("hue-slider");
const saturationSlider = document.getElementById("saturation-slider");
const brightnessSlider = document.getElementById("brightness-slider");

const hueValue = document.getElementById("hue-value");
const saturationValue = document.getElementById("saturation-value");
const brightnessValue = document.getElementById("brightness-value");

const livePreview = document.getElementById("live-preview");
const hexDisplay = document.getElementById("hex-display");

const guessPreview = document.getElementById("guess-preview");
const originalPreview = document.getElementById("original-preview");

const roundScoreText = document.getElementById("round-score-text");
const sassyComment = document.getElementById("sassy-comment");

const lockInButton = document.getElementById("lock-in-button");
const nextRoundButton = document.getElementById("next-round-button");
const restartPaletteButton = document.getElementById("restart-palette-button");
const soundButton = document.getElementById("palette-sound-button");

let currentRound = 1;
let totalScore = 0;
let targetColor = null;
let gameState = "memorize";

let audioContext;
let soundEnabled = true;
let masterGain;

/* ---------------------------
   Sound
---------------------------- */

function setupAudio() {
  if (audioContext) return;

  audioContext = new (
    window.AudioContext || window.webkitAudioContext
  )();

  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.12;
  masterGain.connect(audioContext.destination);
}

function unlockAudio() {
  if (!soundEnabled) return;

  setupAudio();

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(frequency, duration, type = "sine", volume = 0.16) {
  if (!soundEnabled) return;

  unlockAudio();

  if (!audioContext || !masterGain) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(
    frequency,
    audioContext.currentTime
  );

  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    volume,
    audioContext.currentTime + 0.02
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContext.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(masterGain);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.05);
}

function playRevealSound() {
  playTone(370, 0.1, "triangle", 0.12);

  setTimeout(() => {
    playTone(600, 0.12, "triangle", 0.13);
  }, 110);
}

function playLockInSound() {
  playTone(520, 0.08, "square", 0.1);

  setTimeout(() => {
    playTone(760, 0.14, "triangle", 0.13);
  }, 90);
}

function playGreatScoreSound() {
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((note, index) => {
    setTimeout(() => {
      playTone(note, 0.15, "triangle", 0.18);
    }, index * 105);
  });
}

function playBadScoreSound() {
  playTone(250, 0.12, "sawtooth", 0.09);

  setTimeout(() => {
    playTone(170, 0.2, "sawtooth", 0.08);
  }, 120);
}

function updateSoundButton() {
  soundButton.textContent = soundEnabled
    ? "Sound: On"
    : "Sound: Off";
}

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  updateSoundButton();

  if (soundEnabled) {
    unlockAudio();
    playTone(700, 0.08, "triangle", 0.12);
  }
});

/* ---------------------------
   Color helpers
---------------------------- */

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomColor() {
  return {
    h: randomNumber(0, 360),
    s: randomNumber(42, 96),
    v: randomNumber(45, 95)
  };
}

function hsvToRgb(h, s, v) {
  const saturation = s / 100;
  const brightness = v / 100;

  const chroma = brightness * saturation;
  const hueSection = h / 60;
  const x = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const match = brightness - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSection >= 0 && hueSection < 1) {
    red = chroma;
    green = x;
  } else if (hueSection < 2) {
    red = x;
    green = chroma;
  } else if (hueSection < 3) {
    green = chroma;
    blue = x;
  } else if (hueSection < 4) {
    green = x;
    blue = chroma;
  } else if (hueSection < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) => value.toString(16).padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function colorToCss(color) {
  return rgbToHex(hsvToRgb(color.h, color.s, color.v));
}

function getSliderColor() {
  return {
    h: Number(hueSlider.value),
    s: Number(saturationSlider.value),
    v: Number(brightnessSlider.value)
  };
}

/* ---------------------------
   Score calculation
---------------------------- */

function colorDistance(first, second) {
  const firstRgb = hsvToRgb(first.h, first.s, first.v);
  const secondRgb = hsvToRgb(second.h, second.s, second.v);

  const redDifference = firstRgb.r - secondRgb.r;
  const greenDifference = firstRgb.g - secondRgb.g;
  const blueDifference = firstRgb.b - secondRgb.b;

  return Math.sqrt(
    redDifference ** 2 +
    greenDifference ** 2 +
    blueDifference ** 2
  );
}

function calculateScore(target, guess) {
  const distance = colorDistance(target, guess);

  const maxDistance = Math.sqrt(255 ** 2 * 3);
  const similarity = 1 - distance / maxDistance;

  return Math.max(0, Math.round(similarity * 100));
}

function getSassyComment(score) {
  if (score >= 95) {
    return "Okay color genius. That was suspiciously accurate.";
  }

  if (score >= 85) {
    return "Very good. The color wheel respects you today.";
  }

  if (score >= 72) {
    return "Not bad. You may keep your visual privileges.";
  }

  if (score >= 58) {
    return "Close-ish. The shade survived, emotionally.";
  }

  if (score >= 42) {
    return "You remembered the vibe, not the actual color.";
  }

  if (score >= 25) {
    return "That was a creative interpretation of reality.";
  }

  return "Bestie. Were we looking at the same color?";
}

function getFinalComment(score) {
  if (score >= 270) {
    return "You are genuinely dangerous near a color picker.";
  }

  if (score >= 220) {
    return "That was elite. Pantone is calling.";
  }

  if (score >= 170) {
    return "Respectable. You have decent eyeballs.";
  }

  if (score >= 120) {
    return "You fought bravely against the color spectrum.";
  }

  return "The color wheel filed a complaint.";
}

/* ---------------------------
   UI updates
---------------------------- */

function updateRoundDisplay() {
  roundNumberElement.textContent = `${currentRound} / ${totalRounds}`;
  totalScoreElement.textContent = totalScore;
}

function updateSliderGradient() {
  const hue = Number(hueSlider.value);
  const saturation = Number(saturationSlider.value);
  const brightness = Number(brightnessSlider.value);

  hueSlider.style.background = `
    linear-gradient(
      90deg,
      hsl(0, 100%, 50%),
      hsl(60, 100%, 50%),
      hsl(120, 100%, 50%),
      hsl(180, 100%, 50%),
      hsl(240, 100%, 50%),
      hsl(300, 100%, 50%),
      hsl(360, 100%, 50%)
    )
  `;

  saturationSlider.style.background = `
    linear-gradient(
      90deg,
      hsl(${hue}, 0%, ${brightness / 2}%),
      hsl(${hue}, 100%, ${brightness / 2}%)
    )
  `;

  brightnessSlider.style.background = `
    linear-gradient(
      90deg,
      hsl(${hue}, ${saturation}%, 0%),
      hsl(${hue}, ${saturation}%, 50%)
    )
  `;
}

function updateGuessPreview() {
  const color = getSliderColor();
  const rgb = hsvToRgb(color.h, color.s, color.v);
  const hex = rgbToHex(rgb);
  const cssColor = colorToCss(color);

  hueValue.textContent = `${color.h}°`;
  saturationValue.textContent = `${color.s}%`;
  brightnessValue.textContent = `${color.v}%`;

  hexDisplay.textContent = hex;
  liveStageHex.textContent = hex;

  livePreview.style.background = cssColor;
  liveColorStage.style.background = cssColor;

  updateSliderGradient();
}

function setRandomStartingGuess() {
  hueSlider.value = randomNumber(0, 360);
  saturationSlider.value = randomNumber(35, 95);
  brightnessSlider.value = randomNumber(40, 95);

  updateGuessPreview();
}

/* ---------------------------
   Game flow
---------------------------- */

function showTargetColor() {
  gameState = "memorize";

  controlsPanel.classList.add("hidden");
  guessPanel.classList.add("hidden");
  finalScreen.classList.add("hidden");

  liveColorStage.classList.add("hidden");
  targetColorCard.classList.remove("hidden");

  targetColor = generateRandomColor();

  targetColorCard.style.background = colorToCss(targetColor);

  paletteStatusElement.textContent =
    "Memorize this color. Do not embarrass yourself.";

  const duration = 3000;
  const startTime = performance.now();

  let previousTenth = null;

  function animateCountdown(now) {
    const elapsed = now - startTime;
    const remaining = Math.max(0, duration - elapsed);
    const seconds = remaining / 1000;

    countdownElement.textContent = seconds.toFixed(2);

    const currentTenth = Math.floor(seconds * 10);

    if (currentTenth !== previousTenth) {
      previousTenth = currentTenth;

      countdownElement.classList.remove("countdown-flip");

      requestAnimationFrame(() => {
        countdownElement.classList.add("countdown-flip");
      });
    }

    if (remaining > 0) {
      requestAnimationFrame(animateCountdown);
    } else {
      countdownElement.textContent = "0.00";

      setTimeout(() => {
        beginGuessing();
      }, 180);
    }
  }

  requestAnimationFrame(animateCountdown);
}

function beginGuessing() {
  gameState = "guessing";

  targetColorCard.classList.add("hidden");
  liveColorStage.classList.remove("hidden");
  controlsPanel.classList.remove("hidden");

  paletteStatusElement.textContent =
    "Mix the color. Pretend your eyes are employed.";

  setRandomStartingGuess();
  playRevealSound();
}

function lockInGuess() {
  if (gameState !== "guessing") return;

  gameState = "result";

  const guess = getSliderColor();
  const roundScore = calculateScore(targetColor, guess);

  totalScore += roundScore;
  totalScoreElement.textContent = totalScore;

  guessPreview.style.background = colorToCss(guess);
  originalPreview.style.background = colorToCss(targetColor);

  roundScoreText.textContent = `You scored ${roundScore} / 100`;
  sassyComment.textContent = getSassyComment(roundScore);

  controlsPanel.classList.add("hidden");
  liveColorStage.classList.add("hidden");
  guessPanel.classList.remove("hidden");

  paletteStatusElement.textContent =
    "The verdict is in. Try not to take it personally.";

  playLockInSound();

  if (roundScore >= 75) {
    setTimeout(playGreatScoreSound, 170);
  } else {
    setTimeout(playBadScoreSound, 170);
  }

  if (currentRound === totalRounds) {
    nextRoundButton.textContent = "See Final Score";
  } else {
    nextRoundButton.textContent = "Next Round";
  }
}

function nextRound() {
  if (currentRound >= totalRounds) {
    showFinalScreen();
    return;
  }

  currentRound++;
  updateRoundDisplay();
  showTargetColor();
}

function showFinalScreen() {
  gameState = "complete";

  guessPanel.classList.add("hidden");
  finalScreen.classList.remove("hidden");

  document.getElementById("final-score").textContent =
    `${totalScore} / ${totalRounds * 100}`;

  document.getElementById("final-comment").textContent =
    getFinalComment(totalScore);

  paletteStatusElement.textContent =
    "Game over. The color spectrum has spoken.";

  if (totalScore >= 210) {
    playGreatScoreSound();
  } else {
    playBadScoreSound();
  }
}

function restartGame() {
  currentRound = 1;
  totalScore = 0;

  updateRoundDisplay();
  showTargetColor();
}

/* ---------------------------
   Events
---------------------------- */

[hueSlider, saturationSlider, brightnessSlider].forEach((slider) => {
  slider.addEventListener("input", updateGuessPreview);
});

lockInButton.addEventListener("click", lockInGuess);
nextRoundButton.addEventListener("click", nextRound);
restartPaletteButton.addEventListener("click", restartGame);

updateRoundDisplay();
showTargetColor();