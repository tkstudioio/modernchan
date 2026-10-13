"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BoardForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const board = value.replace(/[^a-z0-9]/gi, "").toLowerCase();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (board) router.push(`/${board}`);
      }}
      className="flex w-full max-w-xs overflow-hidden rounded-full border border-white/15 bg-white/5 focus-within:border-white/40"
    >
      <span className="py-3 pl-4 text-neutral-500">/</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="board"
        aria-label="Nome della board"
        maxLength={10}
        className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-neutral-600"
      />
      <span className="py-3 pr-1 text-neutral-500">/</span>
      <button
        disabled={!board}
        className="m-1 rounded-full bg-white px-4 text-sm font-semibold text-black enabled:hover:bg-neutral-200 disabled:opacity-40"
      >
        🎲 Vai
      </button>
    </form>
  );
}
