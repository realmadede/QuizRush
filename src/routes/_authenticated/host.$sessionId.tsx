import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { sessionAPI } from "@/lib/api-client";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/hooks/useAuth";
import { optionStyle, useCountdownLabel } from "@/lib/quiz-ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/host/$sessionId")({
  head: () => ({
    meta: [
      { title: "Live Game Control — QuizArena" },
      {
        name: "description",
        content:
          "Projector view and host controls for your live QuizArena session: PIN, questions, stats and leaderboard.",
      },
      { property: "og:title", content: "Live Game Control — QuizArena" },
      {
        property: "og:description",
        content:
          "Run your live quiz: show the PIN, launch questions, reveal results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = useQuery({
    queryKey: ["game-state", sessionId],
    queryFn: () => sessionAPI.get(sessionId),
    refetchInterval: 1500,
  });

  const refresh = useCallback(() => {
    void state.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
  useSocket({ sessionId, role: "host", userId: user?.id || undefined }, refresh);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const actionMutation = useMutation({
    mutationFn: (action: string) => sessionAPI.hostAction(sessionId, action),
    onSuccess: () => refresh(),
    onError: (error: Error) =>
      toast.error(error.message || "That action failed."),
  });

  const data = state.data;
  const seconds = useCountdownLabel(data?.endsAt, now);

  if (state.isLoading || !data) {
    return (
      <main className="ink-surface min-h-screen p-10 text-ink-muted">
        Loading live game…
      </main>
    );
  }

  const maxCount = Math.max(
    1,
    ...(data.question?.answers.map((a: any) => a.count ?? 0) ?? [0]),
  );

  return (
    <main className="ink-surface min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display-title text-3xl">{data.quizTitle}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {data.playerCount} {data.playerCount === 1 ? "player" : "players"}{" "}
              ·{" "}
              {data.questionIndex >= 0
                ? `Question ${data.questionIndex + 1} of ${data.totalQuestions}`
                : "Lobby"}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-6 py-3 text-center">
            <p className="text-xs uppercase tracking-widest text-ink-muted">
              Game PIN
            </p>
            <p className="display-title text-3xl tracking-[0.3em]">
              {data.pin}
            </p>
          </div>
        </div>

        {data.phase === "lobby" ? (
          <section className="mt-10 rounded-2xl bg-white/5 p-10 text-center flex flex-col items-center">
            <h2 className="display-title text-2xl">Waiting for players…</h2>
            <div className="mt-8 mb-6 rounded-xl bg-white p-4">
              <QRCodeSVG
                value={`${window.location.origin}/?pin=${data.pin}`}
                size={240}
                level="H"
              />
            </div>
            <p className="mt-2 text-ink-muted">
              Scan the QR code or go to <span className="font-bold text-ink-foreground">{window.location.origin}</span> and enter PIN <span className="font-bold text-ink-foreground">{data.pin}</span>
            </p>
          </section>
        ) : data.phase === "finished" ? (
          <section className="mt-10 rounded-2xl bg-white/5 p-10 text-center">
            <h2 className="display-title text-2xl">Game over</h2>
            <p className="mt-2 text-ink-muted">Final standings below.</p>
          </section>
        ) : data.question ? (
          <section className="mt-10 rounded-2xl bg-white/5 p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="display-title text-2xl">{data.question.text}</h2>
              {data.phase === "question" ? (
                <span className="animate-pulse-ring rounded-full bg-primary px-5 py-2 text-lg font-bold text-primary-foreground">
                  {seconds}s
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {data.answersReceived} of {data.playerCount} answered
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {data.question.answers.map((answer: any, i: number) => (
                <li
                  key={answer.id}
                  className={`rounded-xl p-4 text-quiz-foreground ${optionStyle(i).bg} ${
                    answer.isCorrect === false ? "opacity-40" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">
                      {optionStyle(i).shape} {answer.text}
                    </span>
                    {answer.count !== undefined ? (
                      <span className="font-bold">{answer.count}</span>
                    ) : null}
                  </div>
                  {answer.count !== undefined ? (
                    <div className="mt-2 h-2 rounded-full bg-black/20">
                      <div
                        className="h-2 rounded-full bg-white/80"
                        style={{
                          width: `${Math.round((answer.count / maxCount) * 100)}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.leaderboard.length ? (
          <section className="mt-8 rounded-2xl bg-white/5 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Leaderboard
            </h2>
            <ol className="mt-3 space-y-2">
              {data.leaderboard.slice(0, 10).map((p: any, i: number) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2"
                >
                  <span className="font-semibold">
                    {i + 1}. {p.nickname}
                  </span>
                  <span className="font-bold">{p.score}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <div className="sticky bottom-4 mt-10 flex flex-wrap gap-2 rounded-2xl bg-white/10 p-3 backdrop-blur">
          {data.phase === "lobby" ? (
            <Button
              disabled={actionMutation.isPending || data.playerCount === 0}
              onClick={() => actionMutation.mutate("start_game")}
            >
              Start game
            </Button>
          ) : null}
          {data.phase === "question" ? (
            <Button
              variant="secondary"
              disabled={actionMutation.isPending}
              onClick={() => actionMutation.mutate("end_question")}
            >
              End question now
            </Button>
          ) : null}
          {data.phase === "results" ? (
            <Button
              variant="secondary"
              disabled={actionMutation.isPending}
              onClick={() => actionMutation.mutate("show_leaderboard")}
            >
              Show leaderboard
            </Button>
          ) : null}
          {data.phase === "results" || data.phase === "leaderboard" ? (
            <Button
              disabled={actionMutation.isPending}
              onClick={() => actionMutation.mutate("next_question")}
            >
              {data.questionIndex + 1 >= data.totalQuestions
                ? "Finish game"
                : "Next question"}
            </Button>
          ) : null}
          {data.phase !== "finished" ? (
            <Button
              variant="ghost"
              className="text-ink-foreground hover:bg-white/10"
              disabled={actionMutation.isPending}
              onClick={() => {
                if (window.confirm("End this game for everyone?"))
                  actionMutation.mutate("end_game");
              }}
            >
              End game
            </Button>
          ) : (
            <Button
              onClick={() =>
                navigate({ to: "/results/$sessionId", params: { sessionId } })
              }
            >
              View full results
            </Button>
          )}
          <Button asChild variant="secondary" className="ml-auto">
            <a
              href={`/projector/${sessionId}`}
              target="_blank"
              rel="noreferrer"
            >
              Projector mode
            </a>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-ink-foreground hover:bg-white/10"
          >
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
