import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { getSessionReport } from "@/lib/quiz.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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

        {data.questions && data.questions.length > 0 && (
          <div className="mt-10 space-y-6">
            <h2 className="display-title text-2xl">Question Breakdown</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {data.questions.map((q, i) => {
                const pieData = [
                  {
                    name: "Right",
                    value: q.stats?.correct || 0,
                    color: "#10b981",
                  }, // green-500
                  {
                    name: "Wrong",
                    value: q.stats?.wrong || 0,
                    color: "#ef4444",
                  }, // red-500
                ];

                return (
                  <div
                    key={q.id}
                    className="rounded-2xl border bg-card p-5 shadow-card flex flex-col"
                  >
                    <h3 className="font-semibold line-clamp-2 mb-1">
                      {i + 1}. {q.text}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {q.stats?.attempted} attempted
                    </p>

                    {q.stats?.attempted ? (
                      <div className="h-48 w-full mt-auto">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 w-full flex items-center justify-center text-sm text-muted-foreground bg-muted/20 rounded-xl mt-auto">
                        No answers
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
