import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authAPI } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmail,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: search["token"] as string | undefined,
    };
  },
});

function VerifyEmail() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token provided.");
      return;
    }

    authAPI
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message || "Invalid or expired verification link.");
      });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-2xl">
        <h1 className="display-title mb-4 text-3xl">Email Verification</h1>

        {status === "loading" && (
          <p className="text-muted-foreground">
            Verifying your email, please wait...
          </p>
        )}

        {status === "success" && (
          <div className="space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <p className="text-muted-foreground">
              Your email has been successfully verified and updated.
            </p>
            <Button asChild className="w-full" size="lg">
              <Link to="/auth">Sign in to continue</Link>
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
            <p className="text-destructive font-medium">{errorMsg}</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">Go to Sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
