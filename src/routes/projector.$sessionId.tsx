import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";

import { sessionAPI } from "@/lib/api-client";
import { useSocket } from "@/hooks/useSocket";
import { optionStyle, useCountdownLabel } from "@/lib/quiz-ui";

export const Route = createFileRoute("/projector/$sessionId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Projector Mode — QuizSpark" },
      {
        name: "description",
        content:
          "Big-screen projector display for a live QuizSpark session: PIN, questions, stats and leaderboard.",
      },
      { property: "og:title", content: "Projector Mode — QuizSpark" },
      {
        property: "og:description",
        content:
          "Big-screen live quiz display for classrooms and training rooms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectorPage,
});

function ProjectorPage() {
  const { sessionId } = Route.useParams();
  const state = useQuery({
    queryKey: ["projector-state", sessionId],
    refetchInterval: 1500,
    queryFn: () => sessionAPI.get(sessionId),
  });

  useSocket({ sessionId, role: "spectator" }, () => void state.refetch());

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const data = state.data;
  const seconds = useCountdownLabel(data?.endsAt, now);

  if (!data) {
    return (
      <main className="ink-surface flex min-h-screen items-center justify-center text-ink-muted">
        Loading session…
      </main>
    );
  }

  if (data.phase === "lobby") {
    return (
      <main className="ink-surface flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-2xl">
          <QRCodeSVG
            value={`${window.location.origin}/?pin=${data.pin}`}
            size={360}
            level="H"
          />
        </div>
        <p className="text-3xl uppercase tracking-[0.2em] text-ink-muted">
          Join at{" "}
          <span className="font-bold text-ink-foreground">
            {window.location.host}
          </span>
        </p>
        <div className="mt-8 flex items-center justify-center gap-6">
          <p className="text-4xl text-ink-muted">PIN</p>
          <h1 className="display-title text-7xl sm:text-9xl tracking-[0.2em]">
            {data.pin}
          </h1>
        </div>
        <p className="mt-8 text-2xl">{data.quizTitle}</p>
        <span className="mt-10 animate-pulse-ring rounded-full bg-white/10 px-8 py-3 text-xl">
          {data.playerCount} {data.playerCount === 1 ? "player" : "players"}{" "}
          ready
        </span>
      </main>
    );
  }

  if (data.phase === "finished" || data.phase === "leaderboard") {
    return (
      <main className="ink-surface flex min-h-screen flex-col items-center justify-center px-8">
        <h1 className="display-title text-5xl">
          {data.phase === "finished" ? "Final results" : "Leaderboard"}
        </h1>
        <ol className="mt-10 w-full max-w-2xl space-y-3">
          {data.leaderboard.slice(0, 10).map(
            (
              p: {
                id: string;
                nickname: string;
                score: number;
                avatar?: string;
              },
              i: number,
            ) => (
              <li
                key={p.id}
                className="flex justify-between rounded-2xl bg-white/10 px-6 py-4 text-2xl"
              >
                <span>
                  {i + 1}. {p.nickname}
                </span>
                <span className="font-bold">{p.score}</span>
              </li>
            ),
          )}
        </ol>
      </main>
    );
  }

  const question = data.question;
  if (!question) {
    return (
      <main className="ink-surface flex min-h-screen items-center justify-center text-3xl text-ink-muted">
        Get ready…
      </main>
    );
  }

  const revealed = data.phase === "results";

  return (
    <main className="ink-surface flex min-h-screen flex-col px-8 py-10">
      <div className="flex items-center justify-between text-xl text-ink-muted">
        <span>
          Question {data.questionIndex + 1} of {data.totalQuestions}
        </span>
        <span className="rounded-full bg-white/10 px-6 py-2 text-2xl font-bold text-ink-foreground">
          {revealed ? `${data.answersReceived} answers` : `${seconds}s`}
        </span>
      </div>

      <h1 className="display-title mt-10 text-center text-4xl sm:text-6xl">
        {question.text}
      </h1>

      <div className="mt-12 grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
        {question.answers.map(
          (
            answer: {
              id: string;
              text: string;
              isCorrect?: boolean;
              count?: number;
            },
            i: number,
          ) => (
            <div
              key={answer.id}
              className={`flex items-center justify-between rounded-3xl px-8 py-8 text-3xl font-bold text-quiz-foreground ${
                optionStyle(i).bg
              } ${revealed && !answer.isCorrect ? "opacity-40" : ""}`}
            >
              <span>
                <span className="mr-3">{optionStyle(i).shape}</span>
                {answer.text}
              </span>
              {revealed ? (
                <span className="text-2xl">{answer.count ?? 0}</span>
              ) : null}
            </div>
          ),
        )}
      </div>

      <p className="mt-8 text-center text-xl text-ink-muted">
        {revealed
          ? "Correct answer revealed"
          : `${data.answersReceived} of ${data.playerCount} answered`}
      </p>
    </main>
  );
}
