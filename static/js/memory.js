const memoryBoard = document.getElementById("memory-board");
const playerScoreElement = document.getElementById("player-score");
const aiScoreElement = document.getElementById("ai-score");
const gameStatusElement = document.getElementById("game-status");
const turnDot = document.getElementById("turn-dot");
const restartButton = document.getElementById("restart-memory-button");
const soundButton = document.getElementById("sound-button");

let audioContext;
let soundEnabled = true;
let soundGain;

const pairTypes = [
  { id: "pizza", icon: "🍕", label: "Pizza", animation: "spin-icon" },
  { id: "burger", icon: "🍔", label: "Burger", animation: "pulse-icon" },
  { id: "ramen", icon: "🍜", label: "Ramen", animation: "wave-icon" },
  { id: "sushi", icon: "🍣", label: "Sushi", animation: "float-icon" },
  { id: "taco", icon: "🌮", label: "Taco", animation: "flash-icon" },
  { id: "dumpling", icon: "🥟", label: "Dumplings", animation: "bloom-icon" },
  { id: "cake", icon: "🍰", label: "Cake", animation: "twinkle-icon" },
  { id: "donut", icon: "🍩", label: "Donut", animation: "orbit-icon" },
  { id: "icecream", icon: "🍦", label: "Ice Cream", animation: "fire-icon" },
  { id: "popcorn", icon: "🍿", label: "Popcorn", animation: "drift-icon" }
];

let cards = [];
let selectedCards = [];
let currentTurn = "player";
let playerScore = 0;
let aiScore = 0;
let boardLocked = false;
let gameOver = false;

/*
  The AI stores every card it has seen.
  Example:
  seenCards.get(4) might equal "heart"
*/
const seenCards = new Map();

/* ---------------------------
   Browser-generated sound effects
---------------------------- */

function setupSound() {
  if (audioContext) return;

  audioContext = new (
    window.AudioContext || window.webkitAudioContext
  )();

  soundGain = audioContext.createGain();
  soundGain.gain.value = 0.16;
  soundGain.connect(audioContext.destination);
}

function unlockSound() {
  if (!soundEnabled) return;

  setupSound();

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(frequency, duration, type = "sine", volume = 0.2) {
  if (!soundEnabled) return;

  unlockSound();

  if (!audioContext || !soundGain) return;

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
    audioContext.currentTime + 0.015
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContext.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(soundGain);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.03);
}

function playFlipSound() {
  playTone(420, 0.06, "triangle", 0.12);

  setTimeout(() => {
    playTone(610, 0.05, "triangle", 0.08);
  }, 45);
}

function playMatchSound() {
  playTone(523.25, 0.1, "sine", 0.18);

  setTimeout(() => {
    playTone(659.25, 0.12, "sine", 0.18);
  }, 95);

  setTimeout(() => {
    playTone(783.99, 0.18, "triangle", 0.2);
  }, 195);
}

function playMissSound() {
  playTone(240, 0.12, "sawtooth", 0.12);

  setTimeout(() => {
    playTone(160, 0.18, "sawtooth", 0.1);
  }, 110);
}

function playAiTurnSound() {
  playTone(270, 0.08, "square", 0.08);

  setTimeout(() => {
    playTone(340, 0.1, "square", 0.08);
  }, 95);
}

function playWinSound() {
  const notes = [523.25, 659.25, 783.99, 1046.5];

  notes.forEach((note, index) => {
    setTimeout(() => {
      playTone(note, 0.2, "triangle", 0.2);
    }, index * 115);
  });
}

function playLoseSound() {
  const notes = [392, 330, 262];

  notes.forEach((note, index) => {
    setTimeout(() => {
      playTone(note, 0.2, "sine", 0.13);
    }, index * 135);
  });
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
    unlockSound();
    playTone(660, 0.08, "triangle", 0.12);
  }
});

function shuffle(array) {
  const copiedArray = [...array];

  for (let i = copiedArray.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [copiedArray[i], copiedArray[randomIndex]] = [
      copiedArray[randomIndex],
      copiedArray[i]
    ];
  }

  return copiedArray;
}

function buildDeck() {
  const duplicatedPairs = pairTypes.flatMap((pair) => [
    { ...pair },
    { ...pair }
  ]);

  cards = shuffle(duplicatedPairs).map((card, index) => ({
    ...card,
    index,
    revealed: false,
    matched: false
  }));
}

function createBoard() {
  memoryBoard.innerHTML = "";

  cards.forEach((card) => {
    const cardButton = document.createElement("button");

    cardButton.className = "memory-card";
    cardButton.dataset.index = card.index;
    cardButton.setAttribute("aria-label", "Hidden memory card");

    cardButton.innerHTML = `
      <span class="memory-card-inner">
        <span class="memory-card-front">
          <span class="card-question">?</span>
        </span>

        <span class="memory-card-back ${card.id}">
          <span class="memory-icon ${card.animation}">
            ${card.icon}
          </span>
        </span>
      </span>
    `;

    cardButton.addEventListener("click", () => {
      handlePlayerCardClick(card.index);
    });

    memoryBoard.appendChild(cardButton);
  });
}

function updateBoardCard(index) {
  const card = cards[index];
  const cardElement = memoryBoard.querySelector(
    `.memory-card[data-index="${index}"]`
  );

  if (!cardElement) return;

  cardElement.classList.toggle("revealed", card.revealed);
  cardElement.classList.toggle("matched", card.matched);

  if (card.revealed || card.matched) {
    cardElement.setAttribute("aria-label", `${card.label} card`);
  } else {
    cardElement.setAttribute("aria-label", "Hidden memory card");
  }
}

function updateScores() {
  playerScoreElement.textContent = playerScore;
  aiScoreElement.textContent = aiScore;
}

function updateTurnDisplay() {
  if (gameOver) return;

  if (currentTurn === "player") {
    gameStatusElement.textContent = "Your turn — find a pair.";
    turnDot.classList.remove("ai-turn");
  } else {
    gameStatusElement.textContent = "AI is thinking...";
    turnDot.classList.add("ai-turn");
  }
}

function resetGame() {
  cards = [];
  selectedCards = [];
  playerScore = 0;
  aiScore = 0;
  currentTurn = "player";
  boardLocked = false;
  gameOver = false;

  seenCards.clear();

  buildDeck();
  createBoard();
  updateScores();
  updateTurnDisplay();
}

function revealCard(index) {
  const card = cards[index];

  card.revealed = true;
  seenCards.set(index, card.id);

  updateBoardCard(index);
  playFlipSound();
}

function hideCard(index) {
  cards[index].revealed = false;
  updateBoardCard(index);
}

function handlePlayerCardClick(index) {
  if (gameOver || boardLocked || currentTurn !== "player") {
    return;
  }

  const card = cards[index];

  if (card.revealed || card.matched) {
    return;
  }

  revealCard(index);
  selectedCards.push(index);

  if (selectedCards.length === 2) {
    boardLocked = true;

    setTimeout(() => {
      resolveSelectedCards();
    }, 550);
  }
}

function resolveSelectedCards() {
  const [firstIndex, secondIndex] = selectedCards;

  const firstCard = cards[firstIndex];
  const secondCard = cards[secondIndex];

  const isMatch = firstCard.id === secondCard.id;

  if (isMatch) {
    handleMatch(firstIndex, secondIndex);
  } else {
    handleMiss(firstIndex, secondIndex);
  }
}

function handleMatch(firstIndex, secondIndex) {
  cards[firstIndex].matched = true;
  cards[secondIndex].matched = true;

  updateBoardCard(firstIndex);
  updateBoardCard(secondIndex);

  playMatchSound();

  if (currentTurn === "player") {
    playerScore++;
  } else {
    aiScore++;
  }

  updateScores();
  selectedCards = [];
  boardLocked = false;

  if (playerScore + aiScore === pairTypes.length) {
    endGame();
    return;
  }

  if (currentTurn === "player") {
    gameStatusElement.textContent = "Match! You get another turn.";
  } else {
    gameStatusElement.textContent = "The AI found a match and goes again.";

    setTimeout(() => {
      aiTakeTurn();
    }, 850);
  }
}

function handleMiss(firstIndex, secondIndex) {
  setTimeout(() => {
    hideCard(firstIndex);
    hideCard(secondIndex);
    playMissSound();
    selectedCards = [];
    boardLocked = false;

    switchTurn();
  }, 850);
}

function switchTurn() {
  if (currentTurn === "player") {
    currentTurn = "ai";
    updateTurnDisplay();
    playAiTurnSound();

    setTimeout(() => {
      aiTakeTurn();
    }, 900);
  } else {
    currentTurn = "player";
    updateTurnDisplay();
  }
}

function getAvailableCardIndexes() {
  return cards
    .filter((card) => !card.matched && !card.revealed)
    .map((card) => card.index);
}

function findKnownAiPair() {
  const availableIndexes = getAvailableCardIndexes();

  const groupedCards = {};

  availableIndexes.forEach((index) => {
    if (!seenCards.has(index)) return;

    const cardType = seenCards.get(index);

    if (!groupedCards[cardType]) {
      groupedCards[cardType] = [];
    }

    groupedCards[cardType].push(index);
  });

  for (const cardType in groupedCards) {
    if (groupedCards[cardType].length >= 2) {
      return groupedCards[cardType].slice(0, 2);
    }
  }

  return null;
}

function chooseRandomIndex(indexes) {
  return indexes[Math.floor(Math.random() * indexes.length)];
}

function chooseAiCards() {
  const knownPair = findKnownAiPair();

  if (knownPair && Math.random() < 0.78) {
  return knownPair;
}

  const availableIndexes = getAvailableCardIndexes();

  const firstIndex = chooseRandomIndex(availableIndexes);
  const firstCardType = cards[firstIndex].id;

  const possibleKnownMatch = availableIndexes.find((index) => {
    return (
      index !== firstIndex &&
      seenCards.has(index) &&
      seenCards.get(index) === firstCardType
    );
  });

  if (possibleKnownMatch !== undefined) {
    return [firstIndex, possibleKnownMatch];
  }

  const remainingIndexes = availableIndexes.filter(
    (index) => index !== firstIndex
  );

  const secondIndex = chooseRandomIndex(remainingIndexes);

  return [firstIndex, secondIndex];
}

function aiTakeTurn() {
  if (gameOver || currentTurn !== "ai") {
    return;
  }

  const availableIndexes = getAvailableCardIndexes();

  if (availableIndexes.length < 2) {
    return;
  }

  boardLocked = true;

  const [firstIndex, secondIndex] = chooseAiCards();

  revealCard(firstIndex);
  selectedCards = [firstIndex];

  setTimeout(() => {
    revealCard(secondIndex);
    selectedCards = [firstIndex, secondIndex];

    setTimeout(() => {
      resolveSelectedCards();
    }, 650);
  }, 650);
}

function endGame() {
  gameOver = true;
  boardLocked = true;

  if (playerScore > aiScore) {
    gameStatusElement.textContent =
      `You win ${playerScore}–${aiScore}. Neon memory champion.`;

    turnDot.classList.remove("ai-turn");
    playWinSound();
  } else if (aiScore > playerScore) {
    gameStatusElement.textContent =
      `AI wins ${aiScore}–${playerScore}. It remembered everything.`;

    turnDot.classList.add("ai-turn");
    playLoseSound();
  } else {
    gameStatusElement.textContent =
      `It is a tie: ${playerScore}–${aiScore}. Suspiciously balanced.`;

    playTone(520, 0.15, "triangle", 0.12);
  }
}

restartButton.addEventListener("click", resetGame);

resetGame();