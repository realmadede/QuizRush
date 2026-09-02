import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { sessionAPI } from "@/lib/api-client";
import { savePlayer } from "@/lib/player-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      pin: search.pin as string | undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "QuizArena — Join a Live Quiz with a Game PIN" },
      {
        name: "description",
        content:
          "Enter your 6-digit game PIN and nickname to join a live classroom quiz, answer in real time and climb the leaderboard.",
      },
      {
        property: "og:title",
        content: "QuizArena — Join a Live Quiz with a Game PIN",
      },
      {
        property: "og:description",
        content:
          "Enter your game PIN and nickname to play live quizzes with your class.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user } = useAuth();
  const [pin, setPin] = useState(search.pin || "");
  const [nickname, setNickname] = useState("");

  const mutation = useMutation({
    mutationFn: (vars: { pin: string; nickname: string }) =>
      sessionAPI.join(vars.pin, vars.nickname),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      savePlayer({
        sessionId: result.sessionId!,
        playerId: result.playerId!,
        token: result.token!,
        nickname: result.nickname!,
      });
      navigate({
        to: "/play/$sessionId",
        params: { sessionId: result.sessionId! },
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not join that game."),
  });

  return (
    <main className="ink-surface flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="display-title text-xl">QuizArena</span>
        <Button
          asChild
          variant="ghost"
          className="text-ink-foreground hover:bg-white/10"
        >
          <Link to={user ? "/dashboard" : "/auth"}>
            {user ? "Dashboard" : "Teacher login"}
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md animate-pop-in rounded-3xl bg-card p-8 text-card-foreground shadow-pop">
          <h1 className="display-title text-center text-3xl">Join the game</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Ask your teacher for the 6-digit game PIN on screen.
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({ pin: pin.trim(), nickname: nickname.trim() });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="pin">Game PIN</Label>
              <Input
                id="pin"
                type="tel"
                autoComplete="off"
                placeholder="123456"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.trim().slice(0, 6))}
                className="h-16 text-center text-3xl font-bold tracking-[0.4em]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                placeholder="Your name"
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="h-12 text-center text-lg"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-14 w-full text-lg"
              disabled={
                mutation.isPending ||
                pin.length !== 6 ||
                nickname.trim().length === 0
              }
            >
              {mutation.isPending ? "Joining…" : "Enter"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
