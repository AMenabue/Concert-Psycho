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
      "Errore sul database in fase di registrazione (di solito il trigger su public.profiles). " +
      "Controlla i log Postgres nel dashboard Supabase e la migration " +
      "supabase/migrations/001_fix_profiles_signup_trigger.sql."
    );
  }

  let text = err.message;
  if (err.code) {
    text += ` (codice: ${err.code})`;
  }
  if (isAuthWeakPasswordError(err) && err.reasons.length > 0) {
    text += ` — ${err.reasons.join(", ")}`;
  }

  if (err.status === 422) {
    const hints: Record<string, string> = {
      email_exists:
        "Questa email risulta già registrata: usa «Login» o reimposta la password da Supabase / flusso dedicato.",
      user_already_exists:
        "Utente già presente: prova ad accedere con quella email.",
      weak_password:
        "Password troppo debole per le regole del progetto: in Supabase → Authentication → Providers → Email puoi vedere lunghezza minima e requisiti.",
      signup_disabled:
        "Registrazione nuovi utenti disattivata: in Supabase → Authentication → Providers abilita «Sign up» per email.",
      captcha_failed:
        "CAPTCHA richiesto o non valido: in Authentication disattiva o configura hCaptcha / Turnstile, oppure completa la verifica se l’hai integrata in UI.",
      validation_failed:
        "Dati non accettati dal server: verifica formato email e requisiti password (lunghezza, caratteri).",
      email_address_invalid: "Formato email non valido.",
      over_request_rate_limit:
        "Troppe richieste: attendi qualche minuto o controlla i rate limit in Supabase.",
      hook_timeout:
        "Un Auth Hook (es. Send Email / Custom Access Token) è andato in timeout o ha risposto errore: controlla Authentication → Hooks e i log.",
      hook_payload_invalid_content_type:
        "Auth Hook con payload non valido: verifica l’endpoint configurato in Authentication → Hooks.",
    };
    const hint = err.code ? hints[err.code] : undefined;
    if (hint) {
      text += ` ${hint}`;
    } else if (!err.code) {
      text +=
        " Apri la scheda Network del browser, seleziona la richiesta «signup» e leggi il JSON della risposta (campo msg/code); in parallelo controlla Authentication → Logs in Supabase.";
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
          Accedi
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
              Login
            </button>
            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="flex-1 rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
            >
              Registrati
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
