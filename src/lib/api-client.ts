/**
 * API client for QuizSpark backend
 */

const API_BASE_URL = "/api";

export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = (data as { error?: string })?.error || response.statusText;
    throw new APIError(response.status, response.statusText, message);
  }

  return data as T;
}

// Auth endpoints
export const authAPI = {
  signUp: (email: string, password: string, fullName?: string) =>
    request<{
      token: string;
      user: { id: string; email: string; fullName?: string };
    }>("/auth/sign-up", {
      method: "POST",
      body: JSON.stringify({ email, password, fullName }),
    }),

  signIn: (email: string, password: string) =>
    request<{
      token: string;
      user: { id: string; email: string; fullName?: string };
    }>("/auth/sign-in", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getMe: () =>
    request<{
      id: string;
      email: string;
      fullName?: string;
      roles: string[];
    }>("/auth/me", { method: "GET" }),

  forgotPassword: (email: string) =>
    request<{ ok: boolean }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  updateProfile: (data: { fullName?: string; email?: string }) =>
    request<{
      id: string;
      email: string;
      fullName?: string;
      emailVerificationSent?: boolean;
    }>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  verifyEmail: (token: string) =>
    request<{ ok: boolean }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
};

// Quiz endpoints
export const quizAPI = {
  list: () =>
    request<
      Array<{
        id: string;
        title: string;
        description?: string;
        isPublished: boolean;
        updatedAt: string;
        questionCount: number;
      }>
    >("/quizzes", { method: "GET" }),

  get: (quizId: string) =>
    request<{
      id: string;
      title: string;
      description: string;
      isPublished: boolean;
      questions: Array<{
        id: string;
        text: string;
        position: number;
        timeLimit: number;
        points: number;
        answers: Array<{
          id: string;
          text: string;
          isCorrect: boolean;
        }>;
      }>;
    }>(`/quizzes/${quizId}`, { method: "GET" }),

  create: (title: string, description?: string) =>
    request<{ id: string }>("/quizzes", {
      method: "POST",
      body: JSON.stringify({ title, description }),
    }),

  update: (
    quizId: string,
    data: {
      title?: string | undefined;
      description?: string | undefined;
      isPublished?: boolean | undefined;
      questions?:
        | Array<{
            id?: string;
            position: number;
            text: string;
            timeLimit: number;
            points: number;
            answers: Array<{
              id?: string;
              text: string;
              isCorrect: boolean;
            }>;
          }>
        | undefined;
    },
  ) =>
    request<{ id: string }>(`/quizzes/${quizId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (quizId: string) =>
    request<{ ok: boolean }>(`/quizzes/${quizId}`, {
      method: "DELETE",
    }),
};

// Session endpoints
export const sessionAPI = {
  create: (quizId: string) =>
    request<{ id: string; pin: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ quizId }),
    }),

  join: (pin: string, nickname: string, avatar?: string) =>
    request<{
      ok: boolean;
      message?: string;
      sessionId?: string;
      playerId?: string;
      token?: string;
      nickname?: string;
      avatar?: string;
    }>("/sessions/join", {
      method: "POST",
      body: JSON.stringify({ pin, nickname, avatar }),
    }),

  get: async (sessionId: string) => {
    const data = await request<{
      id: string;
      status: "lobby" | "question" | "results" | "leaderboard" | "finished";
      currentQuestionIndex: number;
      pin: string;
      quiz: {
        id: string;
        title: string;
        questions: Array<{
          id: string;
          text: string;
          position: number;
          timeLimit: number;
          points: number;
          stats?: { attempted: number; correct: number; wrong: number };
          answers: Array<{
            id: string;
            text: string;
            isCorrect: boolean;
            count?: number;
          }>;
        }>;
      };
      players: Array<{
        id: string;
        nickname: string;
        avatar: string;
        score: number;
        correct: number;
        answered: number;
      }>;
      questionStartedAt?: string;
      questionEndsAt?: string;
      answersReceived?: number;
      endedAt?: string;
      createdAt?: string;
    }>(`/sessions/${sessionId}`, { method: "GET" });

    return {
      ...data,
      phase: data.status,
      question: data.quiz.questions[data.currentQuestionIndex],
      quizTitle: data.quiz.title,
      playerCount: data.players.length,
      questionIndex: data.currentQuestionIndex,
      totalQuestions: data.quiz.questions.length,
      leaderboard: [...data.players].sort((a, b) => b.score - a.score),
      endsAt: data.questionEndsAt,
    };
  },

  hostAction: (sessionId: string, action: string) =>
    request<{ status: string }>(`/sessions/${sessionId}/host-action`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
};

// Player endpoints
export const playerAPI = {
  getState: async (playerId: string, token: string) => {
    const data = await request<{
      playerId: string;
      nickname: string;
      score: number;
      sessionStatus: string;
      currentQuestion?: {
        id: string;
        text: string;
        timeLimit: number;
        points: number;
        answers: Array<{
          id: string;
          text: string;
          isCorrect?: boolean;
        }>;
      };
      questionStartedAt?: string;
      questionEndsAt?: string;
      myAnswer?: {
        answerId: string;
        isCorrect: boolean;
        points: number;
      } | null;
      questionIndex: number;
      totalQuestions: number;
      player: {
        rank: number;
        score: number;
        nickname: string;
      };
      leaderboard: Array<{
        id: string;
        nickname: string;
        avatar?: string;
        score: number;
      }>;
    }>("/players/state", {
      method: "POST",
      body: JSON.stringify({ playerId, token }),
    });

    return {
      ...data,
      phase: data.sessionStatus,
      question: data.currentQuestion,
      endsAt: data.questionEndsAt,
    };
  },

  submitAnswer: (playerId: string, token: string, answerId: string) =>
    request<{ pointsAwarded: number }>("/players/answer", {
      method: "POST",
      body: JSON.stringify({ playerId, token, answerId }),
    }),

  rename: (playerId: string, token: string, nickname: string) =>
    request<{ nickname: string }>("/players/rename", {
      method: "POST",
      body: JSON.stringify({ playerId, token, nickname }),
    }),
};

export default {
  authAPI,
  quizAPI,
  sessionAPI,
  playerAPI,
};
