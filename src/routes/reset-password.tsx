import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { authAPI } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { token?: string | undefined } => {
    return {
      token: search["token"] as string | undefined,
    };
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <main className="ink-surface flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="display-title text-3xl">Invalid link</h1>
        <p className="mt-4 text-ink-muted">
          The password reset link is missing or invalid.
        </p>
        <Button asChild className="mt-8">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      await authAPI.resetPassword(token!, password);
      toast.success("Password updated successfully! Please sign in.");
      navigate({ to: "/auth", replace: true });
    } catch (error: any) {
      toast.error(
        error.message || "Failed to reset password. The link may have expired.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ink-surface flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="display-title text-xl">
          QuizArena
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md animate-pop-in rounded-3xl bg-card p-8 text-card-foreground shadow-pop">
          <h1 className="display-title text-center text-2xl">
            Create New Password
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Please enter your new password below.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Must be at least 8 characters.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={busy || password.length < 8}
            >
              {busy ? "Saving..." : "Save Password"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
