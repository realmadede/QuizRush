import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { io } from '../index';

const router = Router();

// Helper: Generate unique PIN
async function generatePin(): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await prisma.gameSession.findUnique({
      where: { pin },
    });
    if (!existing) return pin;
  }
  throw new Error('Could not allocate a game PIN');
}

// Validation schemas
const createSessionSchema = z.object({
  quizId: z.string().uuid(),
});

const joinSessionSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be 6 digits'),
  nickname: z.string().min(1).max(20),
  avatar: z.string().min(1).max(10).optional(),
});

const hostActionSchema = z.object({
  action: z.enum([
    'start_game',
    'start_question',
    'end_question',
    'next_question',
    'show_leaderboard',
    'end_game',
  ]),
});

// Create game session
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = createSessionSchema.parse(req.body);

    // Verify quiz exists and user owns it
    const quiz = await prisma.quiz.findUnique({
      where: { id: data.quizId },
      include: { questions: true },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.ownerId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!quiz.isPublished) {
      return res.status(400).json({ error: 'Cannot start a session for an unpublished quiz.' });
    }

    if (quiz.questions.length === 0) {
      return res.status(400).json({ error: 'Add at least one question before starting a game' });
    }

    const pin = await generatePin();

    const session = await prisma.gameSession.create({
      data: {
        quizId: data.quizId,
        hostId: req.user!.userId,
        pin,
      },
    });

    return res.status(201).json({
      id: session.id,
      pin: session.pin,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

// Join game session
router.post('/join', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const data = joinSessionSchema.parse(req.body);

    const session = await prisma.gameSession.findUnique({
      where: { pin: data.pin },
    });

    if (!session || session.status !== 'lobby') {
      return res.status(400).json({ ok: false, message: 'No live game found for that PIN' });
    }

    // Check nickname uniqueness
    const existingPlayer = await prisma.player.findUnique({
      where: {
        sessionId_nickname: {
          sessionId: session.id,
          nickname: data.nickname,
        },
      },
    });

    if (existingPlayer) {
      return res.status(400).json({ ok: false, message: 'That nickname is already taken' });
    }

    const player = await prisma.player.create({
      data: {
        sessionId: session.id,
        nickname: data.nickname,
        avatar: data.avatar || '🦊',
      },
    });

    // Emit event to host
    io.to(`session:${session.id}`).emit('player_joined', {
      playerId: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
    });

    return res.status(201).json({
      ok: true,
      sessionId: session.id,
      playerId: player.id,
      token: player.token,
      nickname: player.nickname,
      avatar: player.avatar,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, message: 'Invalid input' });
    }
    console.error(error);
    return res.status(500).json({ ok: false, message: 'Failed to join session' });
  }
});

// Get session details
router.get('/:sessionId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: req.params.sessionId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { position: 'asc' },
              include: { answers: { orderBy: { position: 'asc' } } },
            },
          },
        },
        players: {
          include: {
            answers: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const currentQuestion = session.quiz.questions[session.currentQuestionIndex];
    let questionEndsAt = null;
    if (session.questionStartedAt && currentQuestion) {
      questionEndsAt = new Date(
        session.questionStartedAt.getTime() + currentQuestion.timeLimitSeconds * 1000
      ).toISOString();
    }

    // answersReceived is the count of players who have answered the current question
    let answersReceived = 0;
    if (currentQuestion) {
      answersReceived = session.players.filter((p) =>
        p.answers.some((a) => a.questionId === currentQuestion.id)
      ).length;
    }

    return res.json({
      id: session.id,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      pin: session.pin,
      quiz: {
        id: session.quiz.id,
        title: session.quiz.title,
        questions: session.quiz.questions.map((q) => {
          const qAnswers = session.players
            .flatMap((p) => p.answers)
            .filter((a) => a.questionId === q.id);
          const attempted = qAnswers.length;
          const correct = qAnswers.filter((a) => a.isCorrect).length;
          const wrong = attempted - correct;

          return {
            id: q.id,
            text: q.text,
            position: q.position,
            timeLimit: q.timeLimitSeconds,
            points: q.points,
            stats: { attempted, correct, wrong },
            answers: q.answers.map((a) => {
              const count = qAnswers.filter((pa) => pa.answerId === a.id).length;
              return {
                id: a.id,
                text: a.text,
                isCorrect: a.isCorrect,
                count,
              };
            }),
          };
        }),
      },
      players: session.players.map((p) => {
        const answered = p.answers.length;
        const correct = p.answers.filter((a) => a.isCorrect).length;
        return {
          id: p.id,
          nickname: p.nickname,
          avatar: p.avatar,
          score: p.score,
          correct,
          answered,
        };
      }),
      questionStartedAt: session.questionStartedAt?.toISOString(),
      questionEndsAt,
      answersReceived,
      endedAt: session.endedAt?.toISOString(),
      createdAt: session.createdAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to get session' });
  }
});

// Host action (advance game state)
router.post('/:sessionId/host-action', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = hostActionSchema.parse(req.body);
    const { sessionId } = req.params;

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.hostId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let updated = session;

    switch (data.action) {
      case 'start_game':
        updated = await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            status: 'question',
            currentQuestionIndex: 0,
            questionStartedAt: new Date(),
            // questionEndsAt will be set based on time limit
          },
        });
        break;

      case 'start_question':
        updated = await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            status: 'question',
            questionStartedAt: new Date(),
          },
        });
        break;

      case 'end_question':
        updated = await prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: 'results' },
        });
        break;

      case 'show_leaderboard':
        updated = await prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: 'leaderboard' },
        });
        break;

      case 'next_question': {
        const questions = await prisma.question.findMany({
          where: { quizId: session.quizId },
          orderBy: { position: 'asc' },
        });
        const next = session.currentQuestionIndex + 1;
        if (next >= questions.length) {
          updated = await prisma.gameSession.update({
            where: { id: sessionId },
            data: { status: 'finished', endedAt: new Date() },
          });
        } else {
          updated = await prisma.gameSession.update({
            where: { id: sessionId },
            data: {
              status: 'question',
              currentQuestionIndex: next,
              questionStartedAt: new Date(),
            },
          });
        }
        break;
      }

      case 'end_game':
        updated = await prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: 'finished', endedAt: new Date() },
        });
        break;
    }

    // Emit event to all clients
    io.to(`session:${sessionId}`).emit('session_updated', {
      status: updated.status,
      currentQuestionIndex: updated.currentQuestionIndex,
    });

    return res.json({ status: updated.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Failed to perform action' });
  }
});

export default router;
