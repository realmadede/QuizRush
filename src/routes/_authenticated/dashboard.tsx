import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth, signOut } from "@/hooks/useAuth";
import { quizAPI, sessionAPI } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Teacher Dashboard — QuizArena" },
      {
        name: "description",
        content:
          "Manage your quizzes, review past sessions and launch live QuizArena games for your students.",
      },
      { property: "og:title", content: "Teacher Dashboard — QuizArena" },
      {
        property: "og:description",
        content: "Manage quizzes, review results and launch live sessions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const quizzes = useQuery({
    queryKey: ["quizzes"],
    queryFn: () => quizAPI.list(),
  });

  const [title, setTitle] = useState("");

  const createMutation = useMutation({
    mutationFn: (t: string) => quizAPI.create(t),
    onSuccess: (quiz) => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      navigate({ to: "/quizzes/$quizId", params: { quizId: quiz.id } });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not create that quiz."),
  });

  const deleteMutation = useMutation({
    mutationFn: (quizId: string) => quizAPI.delete(quizId),
    onSuccess: () => {
      toast.success("Quiz deleted.");
      void queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not delete that quiz."),
  });

  const launchMutation = useMutation({
    mutationFn: (quizId: string) => sessionAPI.create(quizId),
    onSuccess: (session) =>
      navigate({ to: "/host/$sessionId", params: { sessionId: session.id } }),
    onError: (error: Error) =>
      toast.error(error.message || "Could not start a live game."),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display-title text-3xl">Teacher dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link to="/">Join screen</Link>
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <form
            className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4 shadow-card"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(title.trim());
            }}
          >
            <Input
              className="h-11 flex-1 min-w-56"
              placeholder="New quiz title"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button
              type="submit"
              className="h-11"
              disabled={createMutation.isPending || !title.trim()}
            >
              {createMutation.isPending ? "Creating…" : "Create quiz"}
            </Button>
          </form>

          {quizzes.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading your quizzes…
            </p>
          ) : !quizzes.data?.length ? (
            <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
              <h2 className="text-lg font-semibold">No quizzes yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first quiz above, add questions, then launch a live
                game.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {quizzes.data.map((quiz) => (
                <li
                  key={quiz.id}
                  className="rounded-2xl border bg-card p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold leading-tight">
                      {quiz.title}
                    </h2>
                    {quiz.isPublished ? (
                      <Badge>Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {quiz.questionCount}{" "}
                    {quiz.questionCount === 1 ? "question" : "questions"}
                  </p>
                  {quiz.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {quiz.description}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={
                        launchMutation.isPending || quiz.questionCount === 0
                      }
                      onClick={() => launchMutation.mutate(quiz.id)}
                    >
                      Start live game
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/quizzes/$quizId" params={{ quizId: quiz.id }}>
                        Edit
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${quiz.title}"? This cannot be undone.`,
                          )
                        ) {
                          deleteMutation.mutate(quiz.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
