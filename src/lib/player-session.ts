export type PlayerCredentials = {
  sessionId: string;
  playerId: string;
  token: string;
  nickname: string;
};

const KEY = "quizarena.player";

export function savePlayer(creds: PlayerCredentials) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(creds));
}

export function loadPlayer(sessionId?: string): PlayerCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlayerCredentials;
    if (sessionId && parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPlayer() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
