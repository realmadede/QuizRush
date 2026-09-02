import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { getSessionReport } from "@/lib/quiz.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/results/$sessionId")({
  head: () => ({
    meta: [
      { title: "Session Results — QuizArena" },
      {
        name: "description",
        content:
          "Final standings, accuracy and per-player scores for a completed QuizArena live session.",
      },
      { property: "og:title", content: "Session Results — QuizArena" },
      {
        property: "og:description",
        content: "Review final standings and accuracy for your live quiz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { sessionId } = Route.useParams();
  const report = useQuery({
    queryKey: ["session-report", sessionId],
    queryFn: () => getSessionReport(sessionId),
  });

  if (report.isLoading)
    return (
      <main className="p-10 text-sm text-muted-foreground">
        Loading results…
      </main>
    );
  if (report.isError) {
    return (
      <main className="p-10">
        <p className="text-sm text-destructive">
          {(report.error as Error).message}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </main>
    );
  }

  const data = report.data!;

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Button asChild variant="ghost">
          <Link to="/dashboard">← Dashboard</Link>
        </Button>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="display-title text-3xl">{data.quizTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              PIN {data.pin} · {new Date(data.createdAt).toLocaleString()}
            </p>
          </div>
          <Badge variant={data.endedAt ? "secondary" : "default"}>
            {data.endedAt ? "Finished" : data.status}
          </Badge>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Players" value={String(data.standings.length)} />
          <Stat label="Answers" value={String(data.answersCount)} />
          <Stat label="Accuracy" value={`${data.accuracy}%`} />
        </div>

        {data.standings.length ? (
          <ol className="mt-8 divide-y rounded-2xl border bg-card shadow-card">
            {data.standings.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-lg font-bold text-muted-foreground">
                    {s.rank}
                  </span>
                  <div>
                    <p className="font-semibold">{s.nickname}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.correct}/{s.answered} correct
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold">{s.score}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            No players took part in this session.
          </p>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
