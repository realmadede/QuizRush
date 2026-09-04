import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { io } from '../index';
import { calculateScore } from '../utils/scoring';

const router = Router();

// Validation schemas
const submitAnswerSchema = z.object({
  playerId: z.string().uuid(),
  token: z.string().uuid(),
  answerId: z.string().uuid(),
});

const renamePlayerSchema = z.object({
  playerId: z.string().uuid(),
  token: z.string().uuid(),
  nickname: z.string().min(1).max(20),
});

const getPlayerStateSchema = z.object({
  playerId: z.string().uuid(),
  token: z.string().uuid(),
});

// Get player state
router.post('/state', async (req: Request, res: Response) => {
  try {
    const data = getPlayerStateSchema.parse(req.body);

    const player = await prisma.player.findUnique({
      where: { id: data.playerId },
      include: {
        session: {
          include: {
            quiz: {
              include: {
                questions: {
                  where: { position: { equals: -1 } }, // Will override in logic
                  include: { answers: true },
                },
              },
            },
          },
        },
      },
    });

    if (!player || player.token !== data.token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = player.session;
    const questions = await prisma.question.findMany({
      where: { quizId: session.quizId },
      orderBy: { position: 'asc' },
      include: {
        answers: { orderBy: { position: 'asc' } },
      },
    });

    const currentQuestion = questions[session.currentQuestionIndex] || null;

    // Get leaderboard
    const allPlayers = await prisma.player.findMany({
      where: { sessionId: session.id },
      orderBy: { score: 'desc' },
    });
    const leaderboard = allPlayers.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
    }));

    const rank = allPlayers.findIndex((p) => p.id === player.id) + 1;

    // Check if player has answered the current question
    let myAnswer = null;
    if (currentQuestion) {
      myAnswer = await prisma.playerAnswer.findUnique({
        where: {
          playerId_questionId: {
            playerId: player.id,
            questionId: currentQuestion.id,
          },
        },
      });
    }

    // Calculate question ends at if not present
    let questionEndsAt = session.questionEndsAt;
    if (!questionEndsAt && session.questionStartedAt && currentQuestion) {
      questionEndsAt = new Date(
        session.questionStartedAt.getTime() + currentQuestion.timeLimitSeconds * 1000
      );
    }

    return res.json({
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      sessionStatus: session.status,
      currentQuestion: currentQuestion
        ? {
            id: currentQuestion.id,
            text: currentQuestion.text,
            timeLimit: currentQuestion.timeLimitSeconds,
            points: currentQuestion.points,
            answers: currentQuestion.answers.map((a) => ({
              id: a.id,
              text: a.text,
              isCorrect: a.isCorrect,
            })),
          }
        : null,
      questionStartedAt: session.questionStartedAt?.toISOString(),
      questionEndsAt: questionEndsAt?.toISOString(),
      myAnswer: myAnswer
        ? {
            answerId: myAnswer.answerId,
            isCorrect: myAnswer.isCorrect,
            points: myAnswer.pointsAwarded,
          }
        : null,
      questionIndex: session.currentQuestionIndex,
      totalQuestions: questions.length,
      player: {
        rank,
        score: player.score,
        nickname: player.nickname,
      },
      leaderboard,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Failed to get state' });
  }
});

// Submit answer
router.post('/answer', async (req: Request, res: Response) => {
  try {
    const data = submitAnswerSchema.parse(req.body);

    // Verify player
    const player = await prisma.player.findUnique({
      where: { id: data.playerId },
      include: { session: true },
    });

    if (!player || player.token !== data.token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = player.session;

    // Verify session is in question phase
    if (session.status !== 'question') {
      return res.status(400).json({ error: 'Not in question phase' });
    }

    // Verify time hasn't run out
    if (session.questionEndsAt && new Date(session.questionEndsAt) < new Date()) {
      return res.status(400).json({ error: 'Time is up' });
    }

    // Get question and answer
    const questions = await prisma.question.findMany({
      where: { quizId: session.quizId },
      orderBy: { position: 'asc' },
    });

    const question = questions[session.currentQuestionIndex];
    if (!question) {
      return res.status(400).json({ error: 'No active question' });
    }

    const answer = await prisma.answer.findUnique({
      where: { id: data.answerId },
    });

    if (!answer || answer.questionId !== question.id) {
      return res.status(400).json({ error: 'Invalid answer' });
    }

    // Calculate points
    const responseMs = Date.now() - (session.questionStartedAt?.getTime() || Date.now());
    const points = calculateScore({
      isCorrect: answer.isCorrect,
      basePoints: question.points,
      responseMs,
      timeLimitMs: question.timeLimitSeconds * 1000,
    });

    // Check if player already answered this question
    const existingAnswer = await prisma.playerAnswer.findUnique({
      where: {
        playerId_questionId: {
          playerId: data.playerId,
          questionId: question.id,
        },
      },
    });

    const newPoints = answer.isCorrect ? points : 0;
    let pointsDiff = 0;

    if (existingAnswer) {
      pointsDiff = newPoints - existingAnswer.pointsAwarded;
      await prisma.playerAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          answerId: data.answerId,
          isCorrect: answer.isCorrect,
          pointsAwarded: newPoints,
          responseMs,
        },
      });
    } else {
      pointsDiff = newPoints;
      await prisma.playerAnswer.create({
        data: {
          playerId: data.playerId,
          sessionId: session.id,
          questionId: question.id,
          answerId: data.answerId,
          isCorrect: answer.isCorrect,
          pointsAwarded: newPoints,
          responseMs,
        },
      });
    }

    // Update player score
    await prisma.player.update({
      where: { id: data.playerId },
      data: {
        score: player.score + pointsDiff,
      },
    });

    // Notify host of answer
    if (!existingAnswer) {
      io.to(`session:${session.id}`).emit('answer_submitted', {
        playerId: data.playerId,
        isCorrect: answer.isCorrect,
      });
    }

    return res.json({ pointsAwarded: newPoints });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// Rename player
router.post('/rename', async (req: Request, res: Response) => {
  try {
    const data = renamePlayerSchema.parse(req.body);

    const player = await prisma.player.findUnique({
      where: { id: data.playerId },
      include: { session: true },
    });

    if (!player || player.token !== data.token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (player.session.status !== 'lobby') {
      return res.status(400).json({ error: 'Game already started' });
    }

    // Check nickname uniqueness
    const existing = await prisma.player.findUnique({
      where: {
        sessionId_nickname: {
          sessionId: player.sessionId,
          nickname: data.nickname,
        },
      },
    });

    if (existing && existing.id !== data.playerId) {
      return res.status(400).json({ error: 'Nickname already taken' });
    }

    const updated = await prisma.player.update({
      where: { id: data.playerId },
      data: { nickname: data.nickname },
    });

    // Notify session
    io.to(`session:${player.sessionId}`).emit('player_renamed', {
      playerId: data.playerId,
      nickname: data.nickname,
    });

    return res.json({ nickname: updated.nickname });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Failed to rename' });
  }
});

export default router;
