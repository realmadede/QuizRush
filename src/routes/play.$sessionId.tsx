import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { clearPlayer, loadPlayer, savePlayer, type PlayerCredentials } from "@/lib/player-session";
import { playerAPI, sessionAPI } from "@/lib/api-client";
import { useSocket } from "@/hooks/useSocket";
import { optionStyle, useCountdownLabel } from "@/lib/quiz-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/play/$sessionId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Playing a Live Quiz — QuizArena" },
      {
        name: "description",
        content:
          "You are in a live QuizArena session. Answer each question as fast as you can.",
      },
      { property: "og:title", content: "Playing a Live Quiz — QuizArena" },
      {
        property: "og:description",
        content: "Answer live quiz questions in real time.",
      },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<PlayerCredentials | null>(null);
  const [players, setPlayers] = useState<{ id: string; nickname: string }[]>(
    [],
  );

  useEffect(() => {
    const saved = loadPlayer(sessionId);
    if (!saved) {
      navigate({ to: "/", replace: true });
      return;
    }
    setPlayer(saved);
  }, [sessionId, navigate]);

  const state = useQuery({
    queryKey: ["player-state", player?.playerId],
    enabled: !!player,
    refetchInterval: 1500,
    queryFn: () => playerAPI.getState(player!.playerId, player!.token),
  });

  const refresh = useCallback(async () => {
    void state.refetch();
    try {
      const sessionData = await sessionAPI.get(sessionId);
      setPlayers(sessionData.players ?? []);
    } catch (e) {
      // Ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useSocket(
    {
      sessionId,
      role: "player",
      playerId: player?.playerId,
      token: player?.token,
    },
    () => void refresh(),
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const renameMutation = useMutation({
    mutationFn: (nickname: string) =>
      playerAPI.rename(player!.playerId, player!.token, nickname),
    onSuccess: (result) => {
      const next = { ...player!, nickname: result.nickname };
      savePlayer(next);
      setPlayer(next);
      setEditing(false);
      void refresh();
      toast.success("Nickname updated.");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not change your nickname."),
  });

  const answerMutation = useMutation({
    mutationFn: (answerId: string) =>
      playerAPI.submitAnswer(player!.playerId, player!.token, answerId),
    onSuccess: () => void refresh(),
    onError: (error: Error) =>
      toast.error(error.message || "Could not send your answer."),
  });

  const data = state.data;
  const seconds = useCountdownLabel(data?.endsAt, now);

  if (!player) return null;

  function leave() {
    clearPlayer();
    setPlayer(null);
    setPlayers([]);
    toast.success("You left the session.");
    navigate({ to: "/", replace: true });
  }

  // ---- Lobby ----
  if (!data || data.phase === "lobby") {
    return (
      <main className="ink-surface flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <div className="animate-pop-in w-full max-w-lg">
          <p className="text-sm uppercase tracking-widest text-ink-muted">
            You're in!
          </p>

          {editing ? (
            <form
              className="mx-auto mt-3 flex max-w-sm gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                renameMutation.mutate(draft.trim());
              }}
            >
              <Input
                autoFocus
                maxLength={20}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-12 text-center text-lg"
              />
              <Button
                type="submit"
                className="h-12"
                disabled={renameMutation.isPending || !draft.trim()}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-12 text-ink-foreground hover:bg-white/10"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <h1 className="display-title mt-3 text-4xl">{player.nickname}</h1>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-ink-muted hover:bg-white/10"
                onClick={() => {
                  setDraft(player.nickname);
                  setEditing(true);
                }}
              >
                Change nickname
              </Button>
            </>
          )}

          <p className="mt-4 text-ink-muted">
            Waiting for your teacher to start the game. Keep this screen open.
          </p>
          <span className="mt-8 inline-block animate-pulse-ring rounded-full bg-white/10 px-6 py-2 text-sm">
            {players.length} {players.length === 1 ? "player" : "players"} in
            the lobby
          </span>

          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {players.map((p) => (
              <li
                key={p.id}
                className={`animate-pop-in rounded-full px-4 py-2 text-sm font-semibold ${
                  p.id === player.playerId
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/10 text-ink-foreground"
                }`}
              >
                {p.nickname}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Button
              variant="ghost"
              className="text-ink-foreground hover:bg-white/10"
              onClick={leave}
            >
              Leave session
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // ---- Finished ----
  if (data.phase === "finished") {
    return (
      <main className="ink-surface flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="animate-pop-in">
          <p className="text-sm uppercase tracking-widest text-ink-muted">
            Game over
          </p>
          <h1 className="display-title mt-2 text-4xl">#{data.player.rank}</h1>
          <p className="mt-2 text-lg">
            {data.player.nickname} · {data.player.score} points
          </p>
          <ol className="mx-auto mt-8 w-72 space-y-2 text-left">
            {data.leaderboard.map((p: any, i: number) => (
              <li
                key={p.id}
                className="flex justify-between rounded-xl bg-white/10 px-4 py-2"
              >
                <span>
                  {i + 1}. {p.nickname}
                </span>
                <span className="font-bold">{p.score}</span>
              </li>
            ))}
          </ol>
          <Button
            variant="ghost"
            className="mt-8 text-ink-foreground hover:bg-white/10"
            onClick={leave}
          >
            Leave session
          </Button>
        </div>
      </main>
    );
  }

  // ---- Leaderboard between questions ----
  if (data.phase === "leaderboard") {
    return (
      <main className="ink-surface flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="animate-pop-in w-full max-w-sm">
          <p className="text-sm uppercase tracking-widest text-ink-muted">
            Standings
          </p>
          <h1 className="display-title mt-2 text-3xl">
            #{data.player.rank} · {data.player.score} pts
          </h1>
          <ol className="mt-6 space-y-2 text-left">
            {data.leaderboard.map((p: any, i: number) => (
              <li
                key={p.id}
                className="flex justify-between rounded-xl bg-white/10 px-4 py-2"
              >
                <span>
                  {i + 1}. {p.nickname}
                </span>
                <span className="font-bold">{p.score}</span>
              </li>
            ))}
          </ol>
        </div>
      </main>
    );
  }

  const question = data.question;
  if (!question) {
    return (
      <main className="ink-surface flex min-h-screen items-center justify-center text-ink-muted">
        Get ready…
      </main>
    );
  }

  const answered = !!data.myAnswer;

  // ---- Results reveal ----
  if (data.phase === "results") {
    return (
      <main className="ink-surface flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="animate-pop-in w-full max-w-md">
          <h1 className="display-title text-3xl">
            {!answered
              ? "No answer"
              : data.myAnswer?.isCorrect
                ? "Correct!"
                : "Not this time"}
          </h1>
          {answered && data.myAnswer?.points ? (
            <p className="mt-2 text-lg text-ink-muted">
              +{data.myAnswer.points} points
            </p>
          ) : null}
          <p className="mt-6 text-lg">{question.text}</p>
          <ul className="mt-4 space-y-2 text-left">
            {question.answers.map((a, i) => (
              <li
                key={a.id}
                className={`rounded-xl px-4 py-3 font-semibold text-quiz-foreground ${optionStyle(i).bg} ${
                  a.isCorrect ? "" : "opacity-40"
                }`}
              >
                {optionStyle(i).shape} {a.text}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-ink-muted">
            {data.player.score} points · rank #{data.player.rank}
          </p>
        </div>
      </main>
    );
  }

  // ---- Answering ----
  return (
    <main className="ink-surface flex min-h-screen flex-col px-4 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Question {data.questionIndex + 1} of {data.totalQuestions}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 font-bold text-ink-foreground">
            {seconds}s
          </span>
        </div>

        <h1 className="display-title mt-6 text-center text-2xl sm:text-3xl">
          {question.text}
        </h1>

        <div className="mt-8 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          {question.answers.map((a: any, i: number) => {
            const chosen = data.myAnswer?.answerId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                disabled={answered || answerMutation.isPending}
                onClick={() => answerMutation.mutate(a.id)}
                className={`min-h-24 rounded-2xl px-5 py-4 text-left text-lg font-bold text-quiz-foreground transition ${
                  optionStyle(i).bg
                } ${answered && !chosen ? "opacity-40" : "active:scale-[0.98]"} ${
                  chosen ? "ring-4 ring-white" : ""
                }`}
              >
                <span className="mr-2">{optionStyle(i).shape}</span>
                {a.text}
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {answered
            ? "Answer locked in — waiting for everyone else."
            : "Tap an answer. Faster = more points."}
        </p>
      </div>
    </main>
  );
}
