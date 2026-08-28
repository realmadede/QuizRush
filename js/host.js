import { db } from "./firebase-config.js";
import {
    doc, setDoc, getDoc, updateDoc, deleteDoc,   // ← FIX: deleteDoc was missing
    onSnapshot, serverTimestamp
} from "firebase/firestore";
import { generateUniquePIN, fetchQuizzes, calculateScore, rankLabel } from "./utils.js";

// ===== DOM refs =====
const quizSelect    = document.getElementById("quizSelect");
const createBtn     = document.getElementById("createGameBtn");
const setupError    = document.getElementById("setupError");
const quizPreview   = document.getElementById("quizPreview");
const previewText   = document.getElementById("previewText");

const pinDisplay    = document.getElementById("pinDisplay");
const playerList    = document.getElementById("playerList");
const playerCount   = document.getElementById("playerCount");
const lobbyEmpty    = document.getElementById("lobbyEmpty");
const startBtn      = document.getElementById("startGameBtn");
const cancelBtn     = document.getElementById("cancelGameBtn");
const lobbyError    = document.getElementById("lobbyError");

const qProgress     = document.getElementById("qProgress");
const qTimerBadge   = document.getElementById("qTimerBadge");
const timerBarFill  = document.getElementById("timerBarFill");
const qText         = document.getElementById("qText");
const qChoices      = document.getElementById("qChoices");
const answeredFill  = document.getElementById("answeredFill");
const answeredText  = document.getElementById("answeredText");
const nextStateBtn  = document.getElementById("nextStateBtn");

const lbList        = document.getElementById("lbList");
const lbRound       = document.getElementById("lbRound");
const nextQBtn      = document.getElementById("nextQuestionBtn");
const finishBtn     = document.getElementById("finishGameBtn");

const finalLbList   = document.getElementById("finalLbList");
const newGameBtn    = document.getElementById("newGameBtn");

// ===== State =====
let currentSessionId = null;
let currentQuiz      = null;
let sessionUnsub     = null;
let timerInterval    = null;
let timerSeconds     = 0;
let isTimerRunning   = false;
let totalPlayerCount = 0;
let lastRenderedQuestionIndex = -1;   // FIX: track which question we rendered

const DARK_VIEWS = ["questionView", "leaderboardView", "finishedView"];

// ===== View switching =====
function showView(id) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(id).classList.add("active");

    // Toggle dark "game stage" styling
    const dark = DARK_VIEWS.includes(id);
    document.body.classList.toggle("game-stage", dark);
}

// ===== Load quiz list =====
async function loadQuizzes() {
    try {
        const quizzes = await fetchQuizzes();
        quizSelect.innerHTML = '<option value="">— Select a quiz —</option>';
        quizzes.forEach(q => {
            const opt = document.createElement("option");
            opt.value = q.id;
            opt.textContent = q.name || q.id;
            opt.dataset.count = (q.questions || []).length;
            quizSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("loadQuizzes:", err);
        showError(setupError, "Failed to load quizzes. Check your connection.");
    }
}
loadQuizzes();

// Show quiz question count preview on select
quizSelect.addEventListener("change", () => {
    const opt = quizSelect.options[quizSelect.selectedIndex];
    if (opt && opt.dataset.count) {
        previewText.textContent = `${opt.dataset.count} question${opt.dataset.count == 1 ? "" : "s"}`;
        quizPreview.classList.remove("hidden");
    } else {
        quizPreview.classList.add("hidden");
    }
});

// ===== Create game =====
createBtn.addEventListener("click", async () => {
    const quizId = quizSelect.value;
    if (!quizId) {
        showError(setupError, "Please select a quiz first.");
        return;
    }
    hideError(setupError);
    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="spinner"></span> Creating…';

    try {
        const quizSnap = await getDoc(doc(db, "quizzes", quizId));
        if (!quizSnap.exists()) throw new Error("Quiz not found.");

        currentQuiz = { id: quizSnap.id, ...quizSnap.data() };
        if (!currentQuiz.questions?.length) throw new Error("This quiz has no questions.");

        const pin = await generateUniquePIN();
        currentSessionId = pin;
        pinDisplay.textContent = pin;

        await setDoc(doc(db, "sessions", pin), {
            quizId,
            status: "lobby",
            currentQuestionIndex: 0,
            players: {},
            createdAt: serverTimestamp(),
        });

        lastRenderedQuestionIndex = -1;
        startSessionListener(pin);
        showView("lobbyView");
    } catch (err) {
        console.error("createGame:", err);
        showError(setupError, err.message || "Failed to create game.");
    } finally {
        createBtn.disabled = false;
        createBtn.innerHTML = "🚀 Launch Game";
    }
});

// ===== Session real-time listener =====
function startSessionListener(pin) {
    if (sessionUnsub) sessionUnsub();

    sessionUnsub = onSnapshot(doc(db, "sessions", pin), snap => {
        if (!snap.exists()) {
            cleanupTimer();
            showView("setupView");
            return;
        }
        const data = snap.data();

        if (data.status === "lobby") {
            renderLobby(data.players);

        } else if (data.status === "question") {
            const qIdx = data.currentQuestionIndex;
            // FIX: re-render whenever question index changes OR view isn't active
            const questionViewActive = document.getElementById("questionView").classList.contains("active");
            if (!questionViewActive || qIdx !== lastRenderedQuestionIndex) {
                lastRenderedQuestionIndex = qIdx;
                showView("questionView");
                renderQuestion(data);
            }
            // Always update answered progress
            updateAnsweredProgress(data);

        } else if (data.status === "leaderboard") {
            cleanupTimer();
            showView("leaderboardView");
            renderLeaderboard(data);

            const isLast = (data.currentQuestionIndex + 1) >= currentQuiz.questions.length;
            nextQBtn.classList.toggle("hidden", isLast);
            finishBtn.classList.toggle("hidden", !isLast);

        } else if (data.status === "finished") {
            cleanupTimer();
            showView("finishedView");
            renderFinalLeaderboard(data);
        }
    }, err => {
        console.error("Session listener:", err);
    });
}

// ===== Render lobby =====
function renderLobby(players) {
    const names = Object.keys(players);
    playerCount.textContent = names.length;
    totalPlayerCount = names.length;

    // Rebuild list only when count changes to avoid flicker
    if (playerList.children.length !== names.length) {
        playerList.innerHTML = names.map(n => `<li>${escapeHtml(n)}</li>`).join("");
    }

    lobbyEmpty.style.display = names.length === 0 ? "block" : "none";
    startBtn.disabled = names.length === 0;
}

// ===== Start game =====
startBtn.addEventListener("click", async () => {
    if (!currentSessionId) return;
    startBtn.disabled = true;
    try {
        await updateDoc(doc(db, "sessions", currentSessionId), {
            status: "question",
            currentQuestionIndex: 0,
        });
    } catch (err) {
        console.error("startGame:", err);
        startBtn.disabled = false;
    }
});

// ===== Cancel game =====
cancelBtn.addEventListener("click", async () => {
    if (!currentSessionId) return;
    if (!confirm("Cancel this game? All players will be disconnected.")) return;
    try {
        await deleteDoc(doc(db, "sessions", currentSessionId));   // FIX: was missing import
        cleanupAndReset();
        showView("setupView");
    } catch (err) {
        console.error("cancelGame:", err);
        showError(lobbyError, "Failed to cancel. Try again.");
    }
});

// ===== Render question =====
function renderQuestion(sessionData) {
    const idx = sessionData.currentQuestionIndex;
    const q   = currentQuiz.questions[idx];
    if (!q) return;

    const total = currentQuiz.questions.length;
    qProgress.textContent = `Q${idx + 1} / ${total}`;
    qText.textContent = q.questionText;

    // Build 4 choice cards (with empty distribution bars)
    const icons  = ["▲", "◆", "●", "■"];
    const letters = ["A", "B", "C", "D"];
    qChoices.innerHTML = "";

    q.choices.forEach((choice, i) => {
        const div = document.createElement("div");
        div.className = "host-choice";
        div.dataset.index = i;
        div.dataset.correct = (i === q.correctAnswerIndex) ? "true" : "false";

        div.innerHTML = `
            <div class="choice-label">
                <span class="choice-icon ci-${i}">${icons[i]}</span>
                <span>${escapeHtml(choice)}</span>
            </div>
            <div class="dist-bar-track">
                <div class="dist-bar-fill dist-fill-${i}" data-idx="${i}" style="width:0%"></div>
            </div>
            <span class="dist-count" data-idx="${i}">0</span>
        `;
        qChoices.appendChild(div);
    });

    // Reset answered progress
    updateAnsweredProgress(sessionData);
    nextStateBtn.disabled = true;

    const timeLimit = q.timeLimit || 20;
    startTimer(timeLimit, () => {
        // Timer expired: enable next button and reveal correct answer
        nextStateBtn.disabled = false;
        revealAnswer();
    });
}

// ===== Update answered progress bar & distribution =====
function updateAnsweredProgress(sessionData) {
    const players  = Object.values(sessionData.players || {});
    const qIdx     = sessionData.currentQuestionIndex;
    const total    = players.length;
    const answered = players.filter(p => p.lastAnsweredIndex === qIdx).length;

    // Progress bar
    const pct = total > 0 ? (answered / total * 100) : 0;
    answeredFill.style.width = `${pct}%`;
    answeredText.textContent = `${answered} / ${total} answered`;

    // Enable next button early if all answered and timer not running
    if (answered >= total && total > 0 && !isTimerRunning) {
        nextStateBtn.disabled = false;
    }

    // Distribution bars
    const counts = [0, 0, 0, 0];
    players.forEach(p => {
        if (p.lastAnsweredIndex === qIdx && typeof p.lastChoiceIndex === "number") {
            if (counts[p.lastChoiceIndex] !== undefined) counts[p.lastChoiceIndex]++;
        }
    });
    counts.forEach((count, i) => {
        const fill  = qChoices.querySelector(`.dist-bar-fill[data-idx="${i}"]`);
        const label = qChoices.querySelector(`.dist-count[data-idx="${i}"]`);
        if (fill && label) {
            const w = total > 0 ? (count / total * 100) : 0;
            fill.style.width  = `${w}%`;
            label.textContent = count;
        }
    });
}

// ===== Reveal correct answer (FIX: was never implemented) =====
function revealAnswer() {
    qChoices.querySelectorAll(".host-choice").forEach(card => {
        if (card.dataset.correct === "true") {
            card.classList.add("correct-highlight");
        } else {
            card.classList.add("wrong-dim");
        }
    });
}

// ===== Timer =====
function startTimer(duration, onFinish) {
    cleanupTimer();
    timerSeconds   = duration;
    isTimerRunning = true;

    timerBarFill.classList.remove("warn", "urgent");
    timerBarFill.style.width = "100%";
    qTimerBadge.textContent  = `${timerSeconds}s`;
    qTimerBadge.classList.remove("urgent");

    timerInterval = setInterval(() => {
        timerSeconds--;
        const pct = (timerSeconds / duration) * 100;
        timerBarFill.style.width = `${pct}%`;
        qTimerBadge.textContent  = `${timerSeconds}s`;

        // Visual warnings
        if (timerSeconds <= 5) {
            timerBarFill.classList.add("urgent");
            qTimerBadge.classList.add("urgent");
        } else if (timerSeconds <= Math.ceil(duration * 0.4)) {
            timerBarFill.classList.add("warn");
        }

        if (timerSeconds <= 0) {
            cleanupTimer();
            isTimerRunning = false;
            if (onFinish) onFinish();
        }
    }, 1000);
}

function cleanupTimer() {
    clearInterval(timerInterval);
    timerInterval  = null;
    isTimerRunning = false;
}

// ===== Show leaderboard =====
nextStateBtn.addEventListener("click", async () => {
    if (!currentSessionId) return;
    cleanupTimer();
    revealAnswer();   // Show correct answer before moving
    try {
        await updateDoc(doc(db, "sessions", currentSessionId), { status: "leaderboard" });
    } catch (err) {
        console.error("nextState:", err);
    }
});

// ===== Render leaderboard =====
function renderLeaderboard(sessionData) {
    const sorted = sortedPlayers(sessionData.players);
    lbList.innerHTML = sorted.map(([name, data], i) =>
        `<li class="lb-item">
            <span class="lb-rank">${rankLabel(i + 1)}</span>
            <span class="lb-name">${escapeHtml(name)}</span>
            <span class="lb-score">${data.score.toLocaleString()}</span>
        </li>`
    ).join("");
    lbRound.textContent = `After Q${sessionData.currentQuestionIndex + 1}`;
}

// ===== Next question =====
nextQBtn.addEventListener("click", async () => {
    if (!currentSessionId) return;
    try {
        const snap = await getDoc(doc(db, "sessions", currentSessionId));
        const nextIdx = snap.data().currentQuestionIndex + 1;
        if (nextIdx >= currentQuiz.questions.length) {
            await updateDoc(doc(db, "sessions", currentSessionId), { status: "finished" });
        } else {
            await updateDoc(doc(db, "sessions", currentSessionId), {
                status: "question",
                currentQuestionIndex: nextIdx,
            });
        }
    } catch (err) {
        console.error("nextQuestion:", err);
    }
});

// ===== Finish game =====
finishBtn.addEventListener("click", async () => {
    if (!currentSessionId) return;
    try {
        await updateDoc(doc(db, "sessions", currentSessionId), { status: "finished" });
    } catch (err) {
        console.error("finishGame:", err);
    }
});

// ===== Final leaderboard =====
function renderFinalLeaderboard(sessionData) {
    const sorted = sortedPlayers(sessionData.players);
    finalLbList.innerHTML = sorted.map(([name, data], i) =>
        `<li class="lb-item">
            <span class="lb-rank">${rankLabel(i + 1)}</span>
            <span class="lb-name">${escapeHtml(name)}</span>
            <span class="lb-score">${data.score.toLocaleString()}</span>
        </li>`
    ).join("");
    launchConfetti();
}

// ===== New game =====
newGameBtn.addEventListener("click", () => {
    cleanupAndReset();
    showView("setupView");
    loadQuizzes();
});

// ===== Helpers =====
function sortedPlayers(players = {}) {
    return Object.entries(players).sort((a, b) => b[1].score - a[1].score);
}

function cleanupAndReset() {
    cleanupTimer();
    if (sessionUnsub) { sessionUnsub(); sessionUnsub = null; }
    currentSessionId = null;
    currentQuiz      = null;
    lastRenderedQuestionIndex = -1;
}

function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove("hidden");
}
function hideError(el) {
    el.textContent = "";
    el.classList.add("hidden");
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Simple CSS-only confetti burst
function launchConfetti() {
    const colors = ["#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6"];
    for (let i = 0; i < 60; i++) {
        const el = document.createElement("div");
        el.className = "confetti-piece";
        el.style.cssText = `
            left: ${Math.random() * 100}vw;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            width: ${6 + Math.random() * 8}px;
            height: ${6 + Math.random() * 8}px;
            animation-duration: ${2 + Math.random() * 2}s;
            animation-delay: ${Math.random() * 0.8}s;
            border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
        `;
        document.body.appendChild(el);
        el.addEventListener("animationend", () => el.remove());
    }
}
