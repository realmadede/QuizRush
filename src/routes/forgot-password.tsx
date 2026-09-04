import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { authAPI } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
      toast.success("Password reset link sent to your email.");
    } catch (error: Error | unknown) {
      toast.error((error instanceof Error ? error.message : "") || "Failed to request reset.");
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
        <Button
          asChild
          variant="ghost"
          className="text-ink-foreground hover:bg-white/10"
        >
          <Link to="/auth">Sign in instead</Link>
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md animate-pop-in rounded-3xl bg-card p-8 text-card-foreground shadow-pop">
          <h1 className="display-title text-center text-2xl">Reset Password</h1>

          {sent ? (
            <div className="mt-6 text-center space-y-4">
              <p className="text-muted-foreground">
                We have sent a password reset link to <strong>{email}</strong>.
                Please check your inbox and spam folder.
              </p>
              <Button
                onClick={() => setSent(false)}
                variant="outline"
                className="w-full"
              >
                Try a different email
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Enter your email address and we will send you a link to reset
                your password.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || !email}
                >
                  {busy ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
