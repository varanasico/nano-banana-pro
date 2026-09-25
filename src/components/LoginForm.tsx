"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Nesprávné heslo.");
        return;
      }
      router.push(searchParams.get("next") ?? "/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6"
    >
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">NANO BANANA PRO Studio</h1>
        <p className="text-sm text-neutral-400">Zadej heslo pro přístup.</p>
      </div>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Heslo"
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-amber-400"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !password}
        className="w-full rounded-md bg-amber-400 px-3 py-2 text-sm font-medium text-neutral-950 transition-opacity disabled:opacity-50"
      >
        {submitting ? "Přihlašuji…" : "Přihlásit"}
      </button>
    </form>
  );
}
