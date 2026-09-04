import { quizAPI, sessionAPI } from "@/lib/api-client";
import { z } from "zod";

const uuid = z.string().uuid();

export const listQuizzes = async () => {
  return quizAPI.list();
};

export const createQuiz = async (title: string) => {
  return quizAPI.create(title);
};

export const deleteQuiz = async (quizId: string) => {
  return quizAPI.delete(quizId);
};

export const getQuiz = async (quizId: string) => {
  return quizAPI.get(quizId);
};

const questionSchema = z.object({
  text: z.string().trim().min(1, "Every question needs text").max(300),
  timeLimit: z.number().int().min(5).max(120),
  points: z.number().int().min(100).max(2000),
  answers: z
    .array(
      z.object({
        text: z.string().trim().min(1, "Answers cannot be empty").max(150),
        isCorrect: z.boolean(),
      }),
    )
    .min(2, "Each question needs at least 2 answers")
    .max(6),
});

const saveSchema = z.object({
  quizId: uuid,
  title: z.string().trim().min(1, "Enter a title").max(120),
  description: z.string().trim().max(500),
  isPublished: z.boolean(),
  questions: z.array(questionSchema).min(1, "Add at least one question"),
});

export type SaveQuizInput = z.infer<typeof saveSchema>;

export const saveQuiz = async (data: SaveQuizInput) => {
  const parsed = saveSchema.parse(data);
  for (const q of parsed.questions) {
    if (!q.answers.some((a) => a.isCorrect)) {
      throw new Error(`"${q.text}" needs at least one correct answer.`);
    }
  }

  // Update quiz metadata and questions
  await quizAPI.update(data.quizId, {
    title: data.title,
    description: data.description ? data.description : undefined,
    isPublished: data.isPublished,
    questions: parsed.questions.map((q, i) => ({
      position: i,
      text: q.text,
      timeLimit: q.timeLimit,
      points: q.points,
      answers: q.answers.map((a) => ({
        text: a.text,
        isCorrect: a.isCorrect,
      })),
    })),
  });

  return { ok: true };
};

export const listSessions = async () => {
  // Note: This would require an additional API endpoint to list sessions
  // For now, returning empty array
  return [];
};

export const getSessionReport = async (sessionId: string) => {
  const session = await sessionAPI.get(sessionId);

  let totalCorrect = 0;
  let totalAnswers = 0;

  const standings = session.leaderboard.map((p, i) => {
    totalCorrect += p.correct;
    totalAnswers += p.answered;

    return {
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      rank: i + 1,
      correct: p.correct,
      answered: p.answered,
    };
  });

  const accuracy =
    totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

  return {
    id: session.id,
    pin: session.pin,
    status: session.status,
    quizTitle: session.quizTitle,
    createdAt: session.createdAt || new Date().toISOString(),
    endedAt: session.endedAt || null,
    accuracy,
    answersCount: totalAnswers,
    standings,
    questions: session.quiz.questions,
  };
};
