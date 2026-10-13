"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Board } from "@/lib/fourchan";

// Ricerca fra le board elencate sotto, per sigla o per nome. Invio apre la
// prima board trovata.
export function BoardBrowser({ boards }: { boards: Board[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().replace(/^\/|\/$/g, "").toLowerCase();
  const found = q ? rank(boards, q) : boards;

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q && found[0]) router.push(`/${found[0].id}`);
        }}
        className="flex w-full max-w-xs overflow-hidden rounded-full border border-white/15 bg-white/5 focus-within:border-white/40"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca una board"
          aria-label="Cerca una board"
          className="min-w-0 flex-1 bg-transparent py-3 pl-4 outline-none placeholder:text-neutral-600"
        />
        <button
          disabled={!q || !found.length}
          className="m-1 rounded-full bg-white px-4 text-sm font-semibold text-black enabled:hover:bg-neutral-200 disabled:opacity-40"
        >
          Vai
        </button>
      </form>

      {found.length ? (
        <>
          <BoardList title="Worksafe" boards={found.filter((b) => b.sfw)} />
          <BoardList title="NSFW" boards={found.filter((b) => !b.sfw)} />
        </>
      ) : (
        <p className="text-neutral-500">Nessuna board trovata</p>
      )}
    </>
  );
}

// prima la sigla esatta, poi quelle che iniziano con la ricerca, poi il resto
function rank(boards: Board[], q: string) {
  const score = (b: Board) => {
    if (b.id === q) return 0;
    if (b.id.startsWith(q)) return 1;
    if (b.name.toLowerCase().startsWith(q)) return 2;
    if (b.id.includes(q)) return 3;
    if (b.name.toLowerCase().includes(q)) return 4;
    return -1;
  };
  return boards
    .map((b) => ({ b, s: score(b) }))
    .filter((x) => x.s >= 0)
    .sort((x, y) => x.s - y.s)
    .map((x) => x.b);
}

function BoardList({ title, boards }: { title: string; boards: Board[] }) {
  if (!boards.length) return null;
  return (
    <section className="w-full">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">{title}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {boards.map((b) => (
          <li key={b.id}>
            <Link
              href={`/${b.id}`}
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-white/30 hover:bg-white/10"
            >
              <span className="font-semibold">/{b.id}/</span>
              <span className="text-sm text-neutral-400">{b.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
