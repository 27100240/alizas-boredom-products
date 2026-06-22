const canvas = document.getElementById("pongCanvas");
const ctx = canvas.getContext("2d");

const playerScoreElement = document.getElementById("player-score");
const aiScoreElement = document.getElementById("ai-score");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const musicButton = document.getElementById("music-button");
const overlay = document.getElementById("message-overlay");

const width = canvas.width;
const height = canvas.height;
const winningScore = 5;

let gameRunning = false;
let animationFrameId;

let playerScore = 0;
let aiScore = 0;

const paddleWidth = 16;
const paddleHeight = 105;
const paddleMargin = 34;
const paddleSpeed = 8;

const player = {
  x: paddleMargin,
  y: height / 2 - paddleHeight / 2
};

const ai = {
  x: width - paddleMargin - paddleWidth,
  y: height / 2 - paddleHeight / 2
};

const ball = {
  x: width / 2,
  y: height / 2,
  radius: 10,
  speed: 6,
  dx: 6,
  dy: 3.4
};

const keys = {
  ArrowUp: false,
  ArrowDown: false
};

/* ---------------------------
   Background music
---------------------------- */

let audioContext;
let masterGain;
let musicTimer;
let musicEnabled = true;
let musicStep = 0;

const bassNotes = [
  110.0,
  110.0,
  130.81,
  146.83,
  110.0,
  164.81,
  146.83,
  130.81
];

const melodyNotes = [
  440.0,
  523.25,
  659.25,
  523.25,
  493.88,
  587.33,
  783.99,
  659.25
];

function setupAudio() {
  if (audioContext) return;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.09;
  masterGain.connect(audioContext.destination);
}

function playTone(frequency, duration, type, volume) {
  if (!audioContext || !musicEnabled) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

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
  oscillator.stop(audioContext.currentTime + duration + 0.03);
}

function playMusicStep() {
  if (!musicEnabled) return;

  const bass = bassNotes[musicStep % bassNotes.length];
  const melody = melodyNotes[musicStep % melodyNotes.length];

  playTone(bass, 0.22, "sine", 0.45);

  if (musicStep % 2 === 0) {
    playTone(melody, 0.14, "triangle", 0.21);
  }

  if (musicStep % 4 === 2) {
    playTone(melody * 2, 0.08, "square", 0.07);
  }

  musicStep++;
}

function startMusic() {
  setupAudio();

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  if (musicTimer) return;

  playMusicStep();
  musicTimer = setInterval(playMusicStep, 185);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

function updateMusicButton() {
  musicButton.textContent = musicEnabled ? "Music: On" : "Music: Off";
}

musicButton.addEventListener("click", () => {
  musicEnabled = !musicEnabled;
  updateMusicButton();

  if (musicEnabled) {
    startMusic();
  } else {
    stopMusic();
  }
});

/* ---------------------------
   Controls
---------------------------- */

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    keys[event.key] = true;
    event.preventDefault();
  }

  if (event.key === " " && !gameRunning) {
    startGame();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    keys[event.key] = false;
  }
});

function movePlayerToPointer(event) {
  const rectangle = canvas.getBoundingClientRect();

  const pointerY =
    (event.clientY - rectangle.top) *
    (canvas.height / rectangle.height);

  player.y = pointerY - paddleHeight / 2;
  keepPaddleInsideArena(player);
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  movePlayerToPointer(event);
});

canvas.addEventListener("pointermove", (event) => {
  movePlayerToPointer(event);
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

/* ---------------------------
   Game setup
---------------------------- */

function startGame() {
  cancelAnimationFrame(animationFrameId);

  playerScore = 0;
  aiScore = 0;

  playerScoreElement.textContent = playerScore;
  aiScoreElement.textContent = aiScore;

  player.y = height / 2 - paddleHeight / 2;
  ai.y = height / 2 - paddleHeight / 2;

  resetBall(Math.random() > 0.5 ? 1 : -1);

  overlay.classList.add("hidden");
  gameRunning = true;

  if (musicEnabled) {
    startMusic();
  }

  gameLoop();
}

function resetBall(direction) {
  ball.x = width / 2;
  ball.y = height / 2;
  ball.speed = 6;
  ball.dx = direction * ball.speed;

  const verticalDirection = Math.random() > 0.5 ? 1 : -1;
  ball.dy = verticalDirection * (Math.random() * 2.3 + 2.3);
}

function gameLoop() {
  update();
  draw();

  if (gameRunning) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

function update() {
  movePlayer();
  moveAi();
  moveBall();
  checkScore();
}

function movePlayer() {
  if (keys.ArrowUp) player.y -= paddleSpeed;
  if (keys.ArrowDown) player.y += paddleSpeed;

  keepPaddleInsideArena(player);
}

function moveAi() {
  const aiCenter = ai.y + paddleHeight / 2;
  const trackingSpeed = 4.5;

  if (ball.y < aiCenter - 12) {
    ai.y -= trackingSpeed;
  } else if (ball.y > aiCenter + 12) {
    ai.y += trackingSpeed;
  }

  keepPaddleInsideArena(ai);
}

function moveBall() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= height) {
    ball.dy *= -1;
    ball.y = Math.max(ball.radius, Math.min(height - ball.radius, ball.y));
  }

  checkPaddleCollision(player);
  checkPaddleCollision(ai);
}

function checkPaddleCollision(paddle) {
  const collision =
    ball.x + ball.radius > paddle.x &&
    ball.x - ball.radius < paddle.x + paddleWidth &&
    ball.y + ball.radius > paddle.y &&
    ball.y - ball.radius < paddle.y + paddleHeight;

  if (!collision) return;

  const movingTowardPlayer = paddle === player && ball.dx < 0;
  const movingTowardAi = paddle === ai && ball.dx > 0;

  if (!movingTowardPlayer && !movingTowardAi) return;

  const paddleCenter = paddle.y + paddleHeight / 2;
  const impactPosition = (ball.y - paddleCenter) / (paddleHeight / 2);

  ball.speed = Math.min(ball.speed + 0.35, 13);

  const direction = paddle === player ? 1 : -1;

  ball.dx = direction * ball.speed;
  ball.dy = impactPosition * ball.speed * 0.75;

  if (Math.abs(ball.dy) < 1.6) {
    ball.dy = ball.dy < 0 ? -1.6 : 1.6;
  }

  ball.x =
    paddle === player
      ? paddle.x + paddleWidth + ball.radius
      : paddle.x - ball.radius;
}

function checkScore() {
  if (ball.x + ball.radius < 0) {
    aiScore++;
    aiScoreElement.textContent = aiScore;
    resetBall(1);
  }

  if (ball.x - ball.radius > width) {
    playerScore++;
    playerScoreElement.textContent = playerScore;
    resetBall(-1);
  }

  if (playerScore >= winningScore || aiScore >= winningScore) {
    endGame();
  }
}

function endGame() {
  gameRunning = false;

  const won = playerScore > aiScore;

  overlay.querySelector("h2").textContent = won ? "You Win!" : "AI Wins";

  overlay.querySelector("p").textContent = won
    ? "You reached 5 first and officially defeated the neon arena."
    : "The AI reached 5 first. The neon arena demands a rematch.";

  startButton.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

/* ---------------------------
   Drawing
---------------------------- */

function keepPaddleInsideArena(paddle) {
  paddle.y = Math.max(0, Math.min(height - paddleHeight, paddle.y));
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  drawBackground();
  drawCenterLine();
  drawPaddle(player, "#35f6ff");
  drawPaddle(ai, "#ff3cac");
  drawBall();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, width, height);

  gradient.addColorStop(0, "#07071b");
  gradient.addColorStop(0.5, "#130a28");
  gradient.addColorStop(1, "#090717");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width / 2,
    height / 2,
    30,
    width / 2,
    height / 2,
    width / 1.2
  );

  glow.addColorStop(0, "rgba(95, 68, 255, 0.12)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawCenterLine() {
  ctx.save();
  ctx.setLineDash([12, 18]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  ctx.restore();
}

function drawPaddle(paddle, color) {
  ctx.save();

  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;

  roundRect(ctx, paddle.x, paddle.y, paddleWidth, paddleHeight, 9);
  ctx.fill();

  const highlight = ctx.createLinearGradient(
    paddle.x,
    paddle.y,
    paddle.x + paddleWidth,
    paddle.y + paddleHeight
  );

  highlight.addColorStop(0, "rgba(255,255,255,0.88)");
  highlight.addColorStop(0.2, "rgba(255,255,255,0.14)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = highlight;

  roundRect(
    ctx,
    paddle.x + 2,
    paddle.y + 2,
    paddleWidth - 4,
    paddleHeight - 4,
    7
  );

  ctx.fill();
  ctx.restore();
}

function drawBall() {
  ctx.save();

  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 28;

  const gradient = ctx.createRadialGradient(
    ball.x - 3,
    ball.y - 4,
    1,
    ball.x,
    ball.y,
    ball.radius
  );

  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.45, "#bdfcff");
  gradient.addColorStop(1, "#34dfff");

  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}