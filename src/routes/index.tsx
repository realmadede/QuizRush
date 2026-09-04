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
  validateSearch: (
    search: Record<string, unknown>,
  ): { pin?: string | undefined } => {
    return {
      pin: search["pin"] as string | undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "QuizSpark — Join a Live Quiz with a Game PIN" },
      {
        name: "description",
        content:
          "Enter your 6-digit game PIN and nickname to join a live classroom quiz, answer in real time and climb the leaderboard.",
      },
      {
        property: "og:title",
        content: "QuizSpark — Join a Live Quiz with a Game PIN",
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
  const [pin, setPin] = useState(String(search.pin || ""));
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🦊");

  const AVATARS = ["🦊", "🦁", "🐼", "🐸", "🐙", "🐧", "🦖", "🦄", "👽", "🤖"];

  const mutation = useMutation({
    mutationFn: (vars: { pin: string; nickname: string; avatar: string }) =>
      sessionAPI.join(vars.pin, vars.nickname, vars.avatar),
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
        avatar: result.avatar || avatar,
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
        <span className="display-title text-xl">QuizSpark</span>
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
              mutation.mutate({
                pin: pin.trim(),
                nickname: nickname.trim(),
                avatar,
              });
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

            <div className="space-y-3 pt-2">
              <Label>Choose your Avatar</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvatar(a)}
                    className={`h-12 text-2xl flex items-center justify-center rounded-xl transition ${
                      avatar === a
                        ? "bg-primary text-primary-foreground scale-110 shadow-lg"
                        : "bg-white/5 hover:bg-white/10 opacity-70 hover:opacity-100"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
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
