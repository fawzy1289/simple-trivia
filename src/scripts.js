/********************************************************
  GLOBAL STATE
********************************************************/
let currentQuestionIndex = 0;
let score = 0;
let questions = [];
let lastPlayedCategory = null;
let currentMode = "normal"; // "normal" or "challenge"

const categoryNames = {
  "21": "Sports",
  "17": "Science",
  "23": "History",
  "9":  "General Knowledge"
};

/********************************************************
  SHOW/HIDE SECTIONS
********************************************************/

//Show the home (long instructions) and hide the quiz UI
 
function showHome() {
  // Show long instructions
  document.getElementById("instructions-long").style.display = "block";

  // Hide short instructions, category buttons, quiz area
  document.getElementById("instructions-short").style.display = "none";
  document.getElementById("category-buttons").style.display = "none";
  document.getElementById("quiz-column").style.display = "none";

  // clear any leftover quiz content:
  resetQuizState();
}



  // Basically the opposite of what we did above (hide homepage --> show quiz page)
 
function startQuiz() {
  document.getElementById("instructions-long").style.display = "none";
  document.getElementById("instructions-short").style.display = "block";
  document.getElementById("category-buttons").style.display = "block";
  document.getElementById("quiz-column").style.display = "block";
}

/********************************************************
  SPINNER & PROGRESS BAR
********************************************************/
function showSpinner() {
  const spinner = document.getElementById("spinner-container");
  if (spinner) spinner.style.display = "block";
}

function hideSpinner() {
  const spinner = document.getElementById("spinner-container");
  if (spinner) spinner.style.display = "none";
}

function updateProgressBar() {
  const progressBar = document.getElementById("progress-bar");
  if (!progressBar || !questions || questions.length === 0) return;
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  progressBar.style.width = `${progress}%`;
  progressBar.setAttribute("aria-valuenow", progress);
}

/********************************************************
  QUIZ LOGIC
********************************************************/
function decodeHTML(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, "text/html").body.textContent; // needed this because API questions had special characters like '&amp;' 
}

function resetQuizState() {
  currentQuestionIndex = 0;
  score = 0;
  questions = [];
  hideSpinner();

  const progressBar = document.getElementById("progress-bar");
  if (progressBar) {
    progressBar.style.width = "0%";
    progressBar.setAttribute("aria-valuenow", "0");
  }

  // Clear old question
  const oldContent = document.querySelector("#quiz-dynamic-content");
  if (oldContent) oldContent.remove();
}

function displayQuestion(question) {
  // Clear old question content
  const oldContent = document.querySelector("#quiz-dynamic-content");
  if (oldContent) oldContent.remove();

  const quizArea = document.getElementById("quiz-area");
  const dynamicContainer = document.createElement("div");
  dynamicContainer.id = "quiz-dynamic-content";

  // Question text
  const questionElem = document.createElement("h2");
  questionElem.textContent = decodeHTML(question.question);
  dynamicContainer.appendChild(questionElem);

  // Answer buttons
  const answersContainer = document.createElement("div");
  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.textContent = decodeHTML(option);
    button.className = "btn btn-secondary m-2";
    button.onclick = () => handleAnswer(option, question.correct_answer, answersContainer);
    answersContainer.appendChild(button);
  });
  dynamicContainer.appendChild(answersContainer);

  quizArea.appendChild(dynamicContainer);
  updateProgressBar();
}

function handleAnswer(selectedAnswer, correctAnswer, answersContainer) {
  if (!answersContainer) return;
  const buttons = answersContainer.querySelectorAll("button");
  buttons.forEach((btn) => (btn.disabled = true));

  if (selectedAnswer === correctAnswer) {
    score++;
    buttons.forEach((btn) => {
      if (btn.textContent === decodeHTML(correctAnswer)) {
        btn.classList.add("btn-success");
      }
    });
  } else {
    buttons.forEach((btn) => {
      if (btn.textContent === decodeHTML(selectedAnswer)) {
        btn.classList.add("btn-danger");
      }
      if (btn.textContent === decodeHTML(correctAnswer)) {
        btn.classList.add("btn-success");
      }
    });
  }

  // Move to next question or final
  setTimeout(() => {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
      displayQuestion(questions[currentQuestionIndex]);
    } else {
      displayFinalScore();
    }
  }, 1000);
}

function displayFinalScore() {
  const oldContent = document.querySelector("#quiz-dynamic-content");
  if (oldContent) oldContent.remove();

  const quizArea = document.getElementById("quiz-area");
  const finalContent = document.createElement("div");
  finalContent.id = "quiz-dynamic-content";

  finalContent.innerHTML = `
    <h2>Quiz Completed!</h2>
    <p>Your final score is ${score} out of ${questions.length}.</p>
    <div class="mb-3">
      <label for="player-name" class="form-label">Enter Your Name:</label>
      <input type="text" id="player-name" class="form-control" placeholder="Name"/>
    </div>
    <button class="btn btn-primary" id="save-score-btn">Save Score</button>
    <button class="btn btn-secondary" onclick="restartQuiz()">Restart Quiz</button>
  `;

  // If normal mode (5 Q) and >= 4, show Hard Mode button
  if (currentMode === "normal" && questions.length === 5 && score >= 4) {
    const hardBtn = document.createElement("button");
    hardBtn.textContent = "Move on to Hard Mode!";
    hardBtn.className = "btn btn-danger ms-2";
    hardBtn.onclick = () => goToHardMode();
    finalContent.appendChild(hardBtn);
  } else if (currentMode === "normal" && questions.length === 5 && score < 4) {
    const lockNote = document.createElement("p");
    lockNote.className = "mt-3 text-danger";
    lockNote.textContent = "You need at least 4 out of 5 to unlock Hard Mode!";
    finalContent.appendChild(lockNote);
  }

  quizArea.appendChild(finalContent);

  const saveBtn = document.getElementById("save-score-btn");
  if (saveBtn) {
    saveBtn.onclick = () => {
      const nameInput = document.getElementById("player-name");
      const playerName = nameInput.value.trim() || "Anonymous";
      saveScoreToBoard(lastPlayedCategory, currentMode, playerName, score);
      displayScoreboard();
      saveBtn.disabled = true;
    };
  }
}

/********************************************************
  FETCH QUESTIONS (Normal or Hard)
********************************************************/
async function fetchQuestionsByCategory(categoryId, questionCount = 5, quizMode = "normal") {
  resetQuizState();
  showSpinner();

  lastPlayedCategory = categoryId;
  currentMode = quizMode;

  const apiUrl = `https://opentdb.com/api.php?amount=${questionCount}&type=multiple&category=${categoryId}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    const data = await response.json();
    if (data.results.length === 0) throw new Error("No questions found!");

    questions = data.results.map((q) => ({
      question: q.question,
      correct_answer: q.correct_answer,
      options: shuffleOptions([...q.incorrect_answers, q.correct_answer]), // spread operator to combine into 1 flat array (instead of an array nested inside)
    }));
    displayQuestion(questions[currentQuestionIndex]);
  } catch (err) {
    console.error("Error fetching questions:", err);
  } finally {
    hideSpinner(); // remove spinner when 'promise' is settled
  }
}

function restartQuiz() {
  if (!lastPlayedCategory) {
    console.error("No last category selected for restart!");
    return;
  }
  fetchQuestionsByCategory(lastPlayedCategory, 5, "normal");
}

function goToHardMode() {
  if (!lastPlayedCategory) {
    console.error("No last category chosen!");
    return;
  }
  fetchQuestionsByCategory(lastPlayedCategory, 10, "challenge");
}

/********************************************************
  SHUFFLE
********************************************************/
function shuffleOptions(options) {
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // had to shuffle because correct answer would be same place for 3 questions which felt really bad while playing.
    [options[i], options[j]] = [options[j], options[i]]; // When i googled I found this "fisher-yates shuffle" which ensures each possible permutation of array is equally likely to occur
  }
  return options;
}

/********************************************************
  SCOREBOARD (LocalStorage)
********************************************************/
function loadScoreboard() {
  const stored = localStorage.getItem("scoreboardData"); 
  return stored ? JSON.parse(stored) : {}; // if there are stored data retrieve it, or just return an empty object.
}

function saveScoreboard(sb) {
  localStorage.setItem("scoreboardData", JSON.stringify(sb)); // helper function to store to localstorage instead of me typing it 5x
}

function saveScoreToBoard(categoryId, mode, playerName, playerScore) {
  const scoreboard = loadScoreboard(); // if exists in localstorage retrieve it, if not return empty object (to not break the game)
  const key = (mode === "challenge") ? `${categoryId}-challenge` : categoryId; // if mode is 'challenge' then key includes id & mode like id-challenge

  if (!scoreboard[key]) scoreboard[key] = []; // if no scores saved yet under this key, set it to empty array

  scoreboard[key].push({
    name: playerName,
    score: playerScore,
    date: new Date().toLocaleString() // save current date + time & make it readable (toLocaleString())
  });

  scoreboard[key].sort((a, b) => b.score - a.score); // sort scores highest-lowest
  scoreboard[key] = scoreboard[key].slice(0, 5); // keep 5 scores only

  saveScoreboard(scoreboard);
}

/********************************************************
  DISPLAY SCOREBOARD
********************************************************/
function displayScoreboard() {
  const boardContainer = document.getElementById("leaderboard-container");
  if (!boardContainer) return;

  const scoreboard = loadScoreboard();
  boardContainer.innerHTML = `<h3 class="mb-3">Top Scores</h3>`;

  const sortedKeys = Object.keys(scoreboard).sort();
  sortedKeys.forEach((key) => {
    const entries = scoreboard[key];
    if (!entries || entries.length === 0) return;

    let catId = key;
    let mode = "normal";
    if (key.includes("-challenge")) {
      catId = key.replace("-challenge", "");
      mode = "challenge";
    }

    const catName = categoryNames[catId] || `Category ${catId}`;
    const modeLabel = (mode === "challenge") ? " (Hard Mode)" : " (Normal)";
    const sectionTitle = catName + modeLabel;

    const catSection = document.createElement("div");
    catSection.className = "scoreboard-category";

    let tableHTML = `
      <h5>${sectionTitle}</h5>
      <table class="scoreboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Score</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;
    entries.forEach((entry, idx) => {
      tableHTML += `
        <tr>
          <td>${idx + 1}</td>
          <td>${entry.name}</td>
          <td>${entry.score}</td>
          <td>${entry.date}</td>
        </tr>
      `;
    });
    tableHTML += `</tbody></table>`;
    catSection.innerHTML = tableHTML;

    boardContainer.appendChild(catSection);
  });
}

/********************************************************
  ON DOM LOAD
********************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // Load scoreboard right away
  displayScoreboard();

  // Clicking the header text -> showHome()
  const homeLink = document.getElementById("home-link");
  if (homeLink) {
    homeLink.onclick = showHome;
  }
});

// Category buttons --> fetch normal mode quiz
document.getElementById("sports-btn").onclick  = () => fetchQuestionsByCategory(21, 5, "normal");
document.getElementById("science-btn").onclick = () => fetchQuestionsByCategory(17, 5, "normal");
document.getElementById("history-btn").onclick = () => fetchQuestionsByCategory(23, 5, "normal");
document.getElementById("general-btn").onclick = () => fetchQuestionsByCategory(9, 5, "normal");
