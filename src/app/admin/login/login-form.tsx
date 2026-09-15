"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="editor@unjbg.local"
          className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Contrasena
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}