import { db } from "./firebase-config.js";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

/**
 * Generates a unique 6-digit numeric PIN not already used in active sessions.
 */
export async function generateUniquePIN() {
    let pin;
    let exists = true;
    while (exists) {
        pin = String(Math.floor(100000 + Math.random() * 900000));
        const snap = await getDoc(doc(db, "sessions", pin));
        exists = snap.exists();
    }
    return pin;
}

/**
 * Fetches all quizzes from Firestore.
 * Expected shape: { name: string, questions: Question[] }
 */
export async function fetchQuizzes() {
    const snap = await getDocs(collection(db, "quizzes"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fisher–Yates shuffle (in-place).
 */
export function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Score calculation: 1000 points at t=0, decays linearly to 500 at t=timeLimit.
 * Returns 0 if time ran out without answering.
 */
export function calculateScore(timeLimit, elapsedSeconds) {
    if (elapsedSeconds >= timeLimit) return 0;
    const ratio = elapsedSeconds / timeLimit;           // 0 → 1
    return Math.round(1000 - ratio * 500);              // 1000 → 500
}

/**
 * Returns a medal emoji for rank 1/2/3, otherwise the rank number string.
 */
export function rankLabel(rank) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return String(rank);
}
