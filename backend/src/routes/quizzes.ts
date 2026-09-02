import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Validation schemas
const createQuizSchema = z.object({
  title: z.string().min(1).max(140),
  description: z.string().max(500).optional(),
});

const answerSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  id: z.string().optional(),
  position: z.number(),
  text: z.string().min(1),
  timeLimit: z.number().default(20),
  points: z.number().default(1000),
  answers: z.array(answerSchema).min(1),
});

const updateQuizSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  description: z.string().max(500).optional(),
  isPublished: z.boolean().optional(),
  questions: z.array(questionSchema).optional(),
});

// List quizzes
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { ownerId: req.user!.userId },
      include: {
        questions: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(
      quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        isPublished: q.isPublished,
        updatedAt: q.updatedAt,
        questionCount: q.questions.length,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to list quizzes' });
  }
});

// Get single quiz
router.get('/:quizId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.quizId },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: {
            answers: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.ownerId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    return res.json({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description || '',
      isPublished: quiz.isPublished,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        position: q.position,
        timeLimit: q.timeLimitSeconds,
        points: q.points,
        answers: q.answers.map((a) => ({
          id: a.id,
          text: a.text,
          isCorrect: a.isCorrect,
        })),
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to get quiz' });
  }
});

// Create quiz
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = createQuizSchema.parse(req.body);

    const quiz = await prisma.quiz.create({
      data: {
        title: data.title,
        description: data.description,
        ownerId: req.user!.userId,
      },
    });

    // Create first question with default answers
    const question = await prisma.question.create({
      data: {
        quizId: quiz.id,
        position: 0,
        text: 'Your first question',
        timeLimitSeconds: 20,
        points: 1000,
      },
    });

    await prisma.answer.createMany({
      data: [
        { questionId: question.id, position: 0, text: 'Correct answer', isCorrect: true },
        { questionId: question.id, position: 1, text: 'Wrong answer', isCorrect: false },
      ],
    });

    return res.status(201).json({ id: quiz.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// Update quiz
router.patch('/:quizId', authMiddleware, async (req: Request, res: Response) => {
  console.log(`[PATCH /quizzes/${req.params.quizId}] Body:`, JSON.stringify(req.body, null, 2));
  try {
    const data = updateQuizSchema.parse(req.body);

    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.quizId },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.ownerId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await prisma.quiz.update({
      where: { id: req.params.quizId },
      data: {
        title: data.title,
        description: data.description,
        isPublished: data.isPublished,
      },
    });

    if (data.questions) {
      // 1. Get all current questions to find ones to delete
      const currentQuestions = await prisma.question.findMany({
        where: { quizId: req.params.quizId },
        select: { id: true }
      });
      
      const newQuestionIds = data.questions.map((q: any) => q.id).filter(Boolean);
      const questionsToDelete = currentQuestions.filter((q: any) => !newQuestionIds.includes(q.id));

      // 2. Delete removed questions
      if (questionsToDelete.length > 0) {
        await prisma.question.deleteMany({
          where: { id: { in: questionsToDelete.map((q: any) => q.id) } }
        });
      }

      // 3. Upsert each question and its answers
      for (const q of data.questions) {
        const questionData = {
          quizId: req.params.quizId,
          position: q.position,
          text: q.text,
          timeLimitSeconds: q.timeLimit,
          points: q.points,
        };

        let questionId = q.id;
        
        if (!questionId || questionId.startsWith('new-')) {
          const createdQ = await prisma.question.create({ data: questionData });
          questionId = createdQ.id;
        } else {
          await prisma.question.update({
            where: { id: questionId },
            data: questionData,
          });
        }

        // Delete existing answers for this question
        await prisma.answer.deleteMany({
          where: { questionId }
        });

        // Create new answers (we recreate them because answers don't hold meaningful historical cascade data in this context)
        await prisma.answer.createMany({
          data: q.answers.map((a: any, index: number) => ({
            questionId: questionId as string,
            position: index,
            text: a.text,
            isCorrect: a.isCorrect,
          })),
        });
      }
    }

    return res.json({ id: updated.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Delete quiz
router.delete('/:quizId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.quizId },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.ownerId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.quiz.delete({
      where: { id: req.params.quizId },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

export default router;
