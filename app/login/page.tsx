"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const signIn = async () => {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/");
  };

  const signUp = async () => {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Check your inbox to confirm your account.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold">Welcome to NovaChat</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to access your private workspace.</p>

        <div className="mt-6 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none ring-0 dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none ring-0 dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            onClick={signIn}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white dark:bg-brand-600"
          >
            Sign in
          </button>
          <button
            onClick={signUp}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Create account
          </button>
          {message && <p className="text-sm text-red-500">{message}</p>}
        </div>
      </div>
    </main>
  );
}
