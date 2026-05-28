"use client";

import { createClient } from "@/lib/supabase/client";
import { isAuthWeakPasswordError } from "@supabase/auth-js";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function formatSignUpError(err: {
  message: string;
  status?: number;
  code?: string;
  name?: string;
}): string {
  if (err.message.includes("Database error saving new user")) {
    return (
      "Database error while creating your account (often the public.profiles trigger). " +
      "Check Postgres logs in the Supabase dashboard and migration " +
      "supabase/migrations/001_fix_profiles_signup_trigger.sql."
    );
  }

  let text = err.message;
  if (err.code) {
    text += ` (code: ${err.code})`;
  }
  if (isAuthWeakPasswordError(err) && err.reasons.length > 0) {
    text += ` — ${err.reasons.join(", ")}`;
  }

  if (err.status === 422) {
    const hints: Record<string, string> = {
      email_exists:
        "This email is already registered. Use Log in or reset your password in Supabase.",
      user_already_exists: "User already exists. Try logging in with that email.",
      weak_password:
        "Password is too weak for this project. In Supabase → Authentication → Providers → Email, check minimum length and requirements.",
      signup_disabled:
        "New sign-ups are disabled. In Supabase → Authentication → Providers, enable email sign-up.",
      captcha_failed:
        "CAPTCHA failed or is required. Disable or configure hCaptcha / Turnstile in Authentication, or complete verification in the UI.",
      validation_failed:
        "Server rejected the data. Check email format and password requirements (length, characters).",
      email_address_invalid: "Invalid email format.",
      over_request_rate_limit:
        "Too many requests. Wait a few minutes or check rate limits in Supabase.",
      hook_timeout:
        "An Auth Hook (e.g. Send Email / Custom Access Token) timed out or returned an error. Check Authentication → Hooks and logs.",
      hook_payload_invalid_content_type:
        "Auth Hook returned an invalid payload. Check the endpoint under Authentication → Hooks.",
    };
    const hint = err.code ? hints[err.code] : undefined;
    if (hint) {
      text += ` ${hint}`;
    } else if (!err.code) {
      text +=
        " Open the browser Network tab, select the signup request, and read the response JSON (msg/code); also check Authentication → Logs in Supabase.";
    }
  }

  return text;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(formatSignUpError(signUpError));
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Sign in
        </h1>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm text-neutral-400">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none ring-neutral-500 focus:ring-2"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm text-neutral-400">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none ring-neutral-500 focus:ring-2"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="flex-1 rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="flex-1 rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
            >
              Sign up
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
