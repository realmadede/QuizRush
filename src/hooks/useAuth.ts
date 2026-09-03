import { useEffect, useState } from "react";
import { authAPI } from "@/lib/api-client";

interface User {
  id: string;
  email: string;
  fullName?: string;
}

export function useAuth() {
  const [session, setSession] = useState<{ user: User } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    // Check if token exists in localStorage and verify it
    const token = localStorage.getItem("token");
    const cachedUser = localStorage.getItem("user");

    if (token && cachedUser) {
      try {
        const userData = JSON.parse(cachedUser);
        setUser(userData);
        setSession({ user: userData });
      } catch (err) {
        // Invalid cached data
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }

    setLoading(false);
  }, []);

  return { session, user, loading, error };
}

export async function signUp(
  email: string,
  password: string,
  fullName?: string,
) {
  try {
    const result = await authAPI.signUp(email, password, fullName);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    return { ok: true, user: result.user };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sign up failed",
    };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const result = await authAPI.signIn(email, password);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    return { ok: true, user: result.user };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sign in failed",
    };
  }
}

export function signOut() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
