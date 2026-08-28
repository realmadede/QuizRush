import { db } from "./firebase-config.js";
import {
    doc, getDoc, updateDoc, onSnapshot, increment
} from "firebase/firestore";
import { calculateScore, rankLabel } from "./utils.js";

// ═══════════════════════════════════════════════════
// Page detection — player.js runs on BOTH index.html
// and player.html, so we guard all DOM access.
// ═══════════════════════════════════════════════════
const IS_JOIN_PAGE   = !!document.getElementById("joinForm");
const IS_PLAYER_PAGE = window.location.pathname.includes("player.html");

// ===== JOIN PAGE (index.html) =====
if (IS_JOIN_PAGE) {
    const joinForm  = document.getElementById("joinForm");
    const pinInput  = document.getElementById("pinInput");
    const nickInput = document.getElementById("nickInput");
    const joinBtn   = document.getElementById("joinBtn");
    const joinError = document.getElementById("joinError");

    // Auto-format PIN to digits only
    pinInput.addEventListener("input", () => {
        pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 6);
    });

    joinForm.addEventListener("submit", async e => {
        e.preventDefault();
        const pin  = pinInput.value.trim();
        const nick = nickInput.value.trim();

        hideEl(joinError);

        if (!pin || !/^\d{6}$/.test(pin)) {
            showError(joinError, "Please enter a valid 6-digit PIN.");
            return;
        }
        if (!nick || nick.length < 2) {
            showError(joinError, "Nickname must be at least 2 characters.");
            return;
        }
        if (nick.includes(".") || nick.includes("/") || nick.includes("$")) {
            showError(joinError, "Nickname cannot contain . / $ characters.");
            return;
        }

        joinBtn.disabled = true;
        joinBtn.innerHTML = '<span class="spinner"></span>';

        try {
            const sessionRef = doc(db, "sessions", pin);
            const snap = await getDoc(sessionRef);

            if (!snap.exists()) {
                showError(joinError, "Game not found. Double-check the PIN.");
                return;
            }
            const data = snap.data();
            if (data.status !== "lobby") {
                showError(joinError, "This game has already started.");
                return;
            }

            const players = data.players || {};
            if (!players[nick]) {
                await updateDoc(sessionRef, {
                    [`players.${nick}`]: {
                        score: 0,
                        lastAnsweredIndex: -1,
                        lastChoiceIndex: -1,
                        wasCorrect: false,
                    }
                });
            }

            // Persist to sessionStorage (not localStorage — clears on tab close)
            sessionStorage.setItem("qr_pin",  pin);
            sessionStorage.setItem("qr_nick", nick);
            window.location.href = "player.html";

        } catch (err) {
            console.error("join:", err);
            showError(joinError, "Something went wrong. Try again.");
        } finally {
            joinBtn.disabled = false;
            joinBtn.innerHTML = "Join Game →";
        }
    });
}

// ===== PLAYER PAGE (player.html) =====
if (IS_PLAYER_PAGE) {
    // ── DOM refs (all exist on player.html) ──
    const playerPinDisplay  = document.getElementById("playerPinDisplay");
    const playerNickDisplay = document.getElementById("playerNickDisplay");
    const playerTimerBadge  = document.getElementById("playerTimerBadge");
    const playerTimerBar    = document.getElementById("playerTimerBar");
    const playerQText       = document.getElementById("playerQText");
    const playerChoices     = document.getElementById("playerChoices");
    const feedbackOverlay   = document.getElementById("playerFeedback");
    const feedbackIcon      = document.getElementById("feedbackIcon");
    const feedbackText      = document.getElementById("feedbackText");
    const feedbackPts       = document.getElementById("feedbackPts");
    const playerLbList      = document.getElementById("playerLbList");
    const playerLbRound     = document.getElementById("playerLbRound");
    const playerFinalLb     = document.getElementById("playerFinalLb");

    // ── Views ──
    const VIEWS = {
        lobby:       document.getElementById("playerLobby"),
        question:    document.getElementById("playerQuestion"),
        leaderboard: document.getElementById("playerLeaderboard"),
        finished:    document.getElementById("playerFinished"),
    };
    const DARK_PLAYER_VIEWS = ["question", "leaderboard", "finished"];

    function showView(name) {
        Object.values(VIEWS).forEach(v => v.classList.remove("active"));
        VIEWS[name].classList.add("active");
        document.body.classList.toggle("game-stage", DARK_PLAYER_VIEWS.includes(name));
    }

    // ── State ──
    let sessionPin = null;
    let playerNick = null;
    let sessionUnsub = null;
    let isAnswered = false;
    let currentQuestionIndex = -1;
    let timerInterval = null;
    let timerDuration = 20;

    // ── Boot ──
    const storedPin  = sessionStorage.getItem("qr_pin");
    const storedNick = sessionStorage.getItem("qr_nick");

    if (!storedPin || !storedNick) {
        window.location.href = "index.html";
    } else {
        sessionPin  = storedPin;
        playerNick  = storedNick;
        playerPinDisplay.textContent  = storedPin;
        playerNickDisplay.textContent = storedNick;
        startPlayerListener(sessionPin);
    }

    // ── Listener ──
    function startPlayerListener(pin) {
        if (sessionUnsub) sessionUnsub();

        sessionUnsub = onSnapshot(doc(db, "sessions", pin), snap => {
            if (!snap.exists()) {
                cleanupTimer();
                // Session deleted by host — go to finished / index
                sessionStorage.removeItem("qr_pin");
                sessionStorage.removeItem("qr_nick");
                window.location.href = "index.html";
                return;
            }

            const data    = snap.data();
            const me      = (data.players || {})[playerNick];

            if (!me) {
                alert("You have been removed from the game.");
                sessionStorage.clear();
                window.location.href = "index.html";
                return;
            }

            if (data.status === "lobby") {
                showView("lobby");

            } else if (data.status === "question") {
                const qIdx = data.currentQuestionIndex;
                if (qIdx !== currentQuestionIndex) {
                    // New question arrived
                    currentQuestionIndex = qIdx;
                    isAnswered = false;
                    renderPlayerQuestion(data);
                }
                showView("question");

                // If we already answered (e.g. page refresh mid-question), lock
                if (me.lastAnsweredIndex === qIdx && !isAnswered) {
                    isAnswered = true;
                    disableChoices();
                }

            } else if (data.status === "leaderboard") {
                cleanupTimer();
                showView("leaderboard");
                renderLeaderboard(data);

            } else if (data.status === "finished") {
                cleanupTimer();
                showView("finished");
                renderFinalLeaderboard(data);
                sessionStorage.removeItem("qr_pin");
                sessionStorage.removeItem("qr_nick");
            }
        }, err => {
            console.error("Player listener:", err);
        });
    }

    // ── Render question ──
    async function renderPlayerQuestion(sessionData) {
        const quizSnap = await getDoc(doc(db, "quizzes", sessionData.quizId));
        if (!quizSnap.exists()) return;

        const q = quizSnap.data().questions[sessionData.currentQuestionIndex];
        if (!q) return;

        playerQText.textContent = q.questionText;

        const icons  = ["▲", "◆", "●", "■"];
        const colors = ["0", "1", "2", "3"];

        playerChoices.innerHTML = "";
        q.choices.forEach((choice, i) => {
            const btn = document.createElement("button");
            btn.className  = "choice-pad";
            btn.dataset.c  = colors[i];
            btn.dataset.idx = i;
            btn.innerHTML  = `<span class="shape">${icons[i]}</span>${escapeHtml(choice)}`;
            btn.addEventListener("click", () => handleAnswer(i, q));
            playerChoices.appendChild(btn);
        });

        timerDuration = q.timeLimit || 20;
        startTimer(timerDuration);
    }

    // ── Timer ──
    function startTimer(duration) {
        cleanupTimer();
        let seconds = duration;
        playerTimerBar.classList.remove("warn", "urgent");
        playerTimerBar.style.width = "100%";
        playerTimerBadge.textContent = `${seconds}s`;
        playerTimerBadge.classList.remove("urgent");

        timerInterval = setInterval(() => {
            seconds--;
            const pct = (seconds / duration) * 100;
            playerTimerBar.style.width = `${pct}%`;
            playerTimerBadge.textContent = `${seconds}s`;

            if (seconds <= 5) {
                playerTimerBar.classList.add("urgent");
                playerTimerBadge.classList.add("urgent");
            } else if (seconds <= Math.ceil(duration * 0.4)) {
                playerTimerBar.classList.add("warn");
            }

            if (seconds <= 0) {
                cleanupTimer();
                if (!isAnswered) {
                    disableChoices();
                    showFeedback(false, "⏰ Time's up!", 0);
                }
            }
        }, 1000);
    }

    function cleanupTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // ── Handle answer ──
    async function handleAnswer(choiceIdx, question) {
        if (isAnswered) return;
        isAnswered = true;
        cleanupTimer();
        disableChoices();

        // Highlight selected pad
        const pads = playerChoices.querySelectorAll(".choice-pad");
        pads[choiceIdx]?.classList.add("selected");

        const timeLimit  = question.timeLimit || 20;
        // Estimate elapsed from the timer badge
        const secsLeft   = parseInt(playerTimerBadge.textContent) || 0;
        const elapsed    = timeLimit - secsLeft;
        const isCorrect  = (choiceIdx === question.correctAnswerIndex);
        const points     = isCorrect ? calculateScore(timeLimit, elapsed) : 0;

        try {
            const sessionRef  = doc(db, "sessions", sessionPin);
            const playerField = `players.${playerNick}`;

            await updateDoc(sessionRef, {
                [`${playerField}.score`]:           increment(points),
                [`${playerField}.lastAnsweredIndex`]: currentQuestionIndex,
                [`${playerField}.lastChoiceIndex`]:   choiceIdx,   // FIX: was missing, needed for host distribution
                [`${playerField}.wasCorrect`]:        isCorrect,
            });

            showFeedback(isCorrect, isCorrect ? "Correct!" : "Wrong!", points);
        } catch (err) {
            console.error("handleAnswer:", err);
        }
    }

    function disableChoices() {
        playerChoices.querySelectorAll(".choice-pad").forEach(b => b.classList.add("disabled"));
    }

    // ── Feedback overlay ──
    function showFeedback(correct, text, pts) {
        feedbackIcon.textContent = correct ? "✅" : "❌";
        feedbackText.textContent = text;
        feedbackPts.textContent  = pts > 0 ? `+${pts.toLocaleString()}` : "+0";
        feedbackOverlay.classList.remove("hidden");

        setTimeout(() => feedbackOverlay.classList.add("hidden"), 2200);
    }

    // ── Leaderboard ──
    function renderLeaderboard(sessionData) {
        const sorted = sortedPlayers(sessionData.players);
        playerLbList.innerHTML = sorted.map(([name, data], i) =>
            `<li class="lb-item">
                <span class="lb-rank">${rankLabel(i + 1)}</span>
                <span class="lb-name">${escapeHtml(name)}</span>
                <span class="lb-score">${data.score.toLocaleString()}</span>
            </li>`
        ).join("");
        playerLbRound.textContent = `After Q${sessionData.currentQuestionIndex + 1}`;
    }

    // ── Final leaderboard ──
    function renderFinalLeaderboard(sessionData) {
        const sorted = sortedPlayers(sessionData.players);
        playerFinalLb.innerHTML = sorted.map(([name, data], i) =>
            `<li class="lb-item">
                <span class="lb-rank">${rankLabel(i + 1)}</span>
                <span class="lb-name">${escapeHtml(name)}</span>
                <span class="lb-score">${data.score.toLocaleString()}</span>
            </li>`
        ).join("");
    }

    // ── Cleanup on tab close ──
    window.addEventListener("beforeunload", () => {
        cleanupTimer();
        if (sessionUnsub) sessionUnsub();
    });
}

// ===== Shared utilities =====
function sortedPlayers(players = {}) {
    return Object.entries(players).sort((a, b) => b[1].score - a[1].score);
}

function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove("hidden");
}
function hideEl(el) {
    el.classList.add("hidden");
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
