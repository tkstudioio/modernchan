import Link from "next/link";
import { BoardForm } from "@/components/board-form";

const BOARDS = [
  { id: "g", name: "Technology" },
  { id: "a", name: "Anime & Manga" },
  { id: "v", name: "Video Games" },
  { id: "wg", name: "Wallpapers" },
  { id: "wsg", name: "Worksafe GIF" },
  { id: "gif", name: "GIF" },
  { id: "ck", name: "Food & Cooking" },
  { id: "diy", name: "Do It Yourself" },
  { id: "sci", name: "Science & Math" },
  { id: "mu", name: "Music" },
  { id: "fit", name: "Fitness" },
  { id: "tv", name: "Television & Film" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Modernchan</h1>
        <p className="mt-3 text-neutral-400">
          Un feed verticale, stile reel, con tutti i media di una board di 4chan.
        </p>
      </header>

      <BoardForm />

      <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        {BOARDS.map((b) => (
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

      <p className="text-center text-xs text-neutral-500">
        Scorciatoie nel feed: ↑↓ naviga · Spazio autoplay · M audio · F schermo intero · P vai al post · +/− secondi · Esc esci
      </p>
    </main>
  );
}
