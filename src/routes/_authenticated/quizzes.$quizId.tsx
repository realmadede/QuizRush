import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getQuiz, saveQuiz } from "@/lib/quiz.functions";
import { createGameSession } from "@/lib/game.functions";
import { optionStyle } from "@/lib/quiz-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/quizzes/$quizId")({
  head: () => ({
    meta: [
      { title: "Quiz Editor — QuizSpark" },
      {
        name: "description",
        content:
          "Write questions, set timers and points, and mark correct answers for your live QuizSpark game.",
      },
      { property: "og:title", content: "Quiz Editor — QuizSpark" },
      {
        property: "og:description",
        content: "Build questions, timers and answers for your live quiz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuizEditor,
});

type DraftAnswer = { text: string; isCorrect: boolean };
type DraftQuestion = {
  text: string;
  timeLimit: number;
  points: number;
  answers: DraftAnswer[];
};

function QuizEditor() {
  const { quizId } = Route.useParams();
  const navigate = useNavigate();

  const quiz = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => getQuiz(quizId),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  useEffect(() => {
    if (!quiz.data) return;
    setTitle(quiz.data.title);
    setDescription(quiz.data.description ?? "");
    setIsPublished(quiz.data.isPublished);
    setQuestions(
      quiz.data.questions.map((q) => ({
        text: q.text,
        timeLimit: q.timeLimit,
        points: q.points,
        answers: q.answers.map((a) => ({
          text: a.text,
          isCorrect: a.isCorrect,
        })),
      })),
    );
  }, [quiz.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveQuiz({ quizId, title, description, isPublished, questions }),
    onSuccess: () => {
      toast.success("Quiz saved.");
      void quiz.refetch();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not save this quiz."),
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      // Auto-save first so the game uses the latest questions
      await saveQuiz({ quizId, title, description, isPublished, questions });
      return createGameSession(quizId);
    },
    onSuccess: (session) =>
      navigate({ to: "/host/$sessionId", params: { sessionId: session.id } }),
    onError: (error: Error) =>
      toast.error(error.message || "Could not start a live game."),
  });

  function patchQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function patchAnswer(qi: number, ai: number, patch: Partial<DraftAnswer>) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? {
              ...q,
              answers: q.answers.map((a, j) =>
                j === ai ? { ...a, ...patch } : a,
              ),
            }
          : q,
      ),
    );
  }

  if (quiz.isLoading) {
    return (
      <main className="p-10 text-sm text-muted-foreground">Loading quiz…</main>
    );
  }
  if (quiz.isError) {
    return (
      <main className="p-10">
        <p className="text-sm text-destructive">
          {(quiz.error as Error).message}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost">
            <Link to="/dashboard">← Dashboard</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 flex items-center gap-2">
              <Switch
                id="published"
                checked={isPublished}
                onCheckedChange={setIsPublished}
              />
              <Label htmlFor="published">Published</Label>
            </div>
            <Button
              variant="outline"
              disabled={launchMutation.isPending || !isPublished}
              onClick={() => launchMutation.mutate()}
            >
              {!isPublished ? "Publish to play" : "Start live game"}
            </Button>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save quiz"}
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border bg-card p-5 shadow-card">
          <Input
            className="h-12 text-lg font-semibold"
            value={title}
            maxLength={120}
            placeholder="Quiz title"
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            value={description}
            maxLength={500}
            placeholder="What is this quiz about?"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <ol className="mt-6 space-y-5">
          {questions.map((question, qi) => (
            <li key={qi} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Question {qi + 1}
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    setQuestions((prev) => prev.filter((_, i) => i !== qi))
                  }
                >
                  Remove
                </Button>
              </div>

              <Textarea
                className="mt-3"
                value={question.text}
                maxLength={300}
                placeholder="Ask something…"
                onChange={(e) => patchQuestion(qi, { text: e.target.value })}
              />

              <div className="mt-3 flex flex-wrap gap-4">
                <div className="w-36">
                  <Label className="text-xs text-muted-foreground">
                    Seconds
                  </Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={question.timeLimit}
                    onChange={(e) =>
                      patchQuestion(qi, { timeLimit: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="w-36">
                  <Label className="text-xs text-muted-foreground">
                    Points
                  </Label>
                  <Input
                    type="number"
                    min={100}
                    max={2000}
                    step={100}
                    value={question.points}
                    onChange={(e) =>
                      patchQuestion(qi, { points: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {question.answers.map((answer, ai) => (
                  <li key={ai} className="flex items-center gap-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-quiz-foreground ${optionStyle(ai).bg}`}
                    >
                      {optionStyle(ai).shape}
                    </span>
                    <Input
                      value={answer.text}
                      maxLength={150}
                      placeholder={`Answer ${ai + 1}`}
                      onChange={(e) =>
                        patchAnswer(qi, ai, { text: e.target.value })
                      }
                    />
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={answer.isCorrect}
                        onCheckedChange={(v) =>
                          patchAnswer(qi, ai, { isCorrect: v })
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        Correct
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={question.answers.length <= 2}
                      onClick={() =>
                        patchQuestion(qi, {
                          answers: question.answers.filter((_, j) => j !== ai),
                        })
                      }
                    >
                      ✕
                    </Button>
                  </li>
                ))}
              </ul>

              {question.answers.length < 6 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() =>
                    patchQuestion(qi, {
                      answers: [
                        ...question.answers,
                        { text: "", isCorrect: false },
                      ],
                    })
                  }
                >
                  Add answer
                </Button>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() =>
              setQuestions((prev) => [
                ...prev,
                {
                  text: "",
                  timeLimit: 20,
                  points: 1000,
                  answers: [
                    { text: "", isCorrect: true },
                    { text: "", isCorrect: false },
                  ],
                },
              ])
            }
          >
            Add multiple choice
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setQuestions((prev) => [
                ...prev,
                {
                  text: "True or False: ",
                  timeLimit: 15,
                  points: 1000,
                  answers: [
                    { text: "True", isCorrect: true },
                    { text: "False", isCorrect: false },
                  ],
                },
              ])
            }
          >
            Add True/False
          </Button>
        </div>
      </div>
    </main>
  );
}
