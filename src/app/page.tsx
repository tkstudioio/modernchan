import Link from "next/link";
import { BoardForm } from "@/components/board-form";
import { getBoards, type Board } from "@/lib/fourchan";

// usato solo se 4chan non risponde
const FALLBACK: Board[] = [
  { id: "g", name: "Technology", sfw: true },
  { id: "a", name: "Anime & Manga", sfw: true },
  { id: "v", name: "Video Games", sfw: true },
  { id: "wg", name: "Wallpapers/General", sfw: true },
  { id: "wsg", name: "Worksafe GIF", sfw: true },
  { id: "ck", name: "Food & Cooking", sfw: true },
  { id: "diy", name: "Do It Yourself", sfw: true },
  { id: "sci", name: "Science & Math", sfw: true },
  { id: "mu", name: "Music", sfw: true },
  { id: "fit", name: "Fitness", sfw: true },
  { id: "tv", name: "Television & Film", sfw: true },
  { id: "gif", name: "Adult GIF", sfw: false },
];

export default async function Home() {
  const boards = await getBoards().catch(() => FALLBACK);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Modernchan</h1>
        <p className="mt-3 text-neutral-400">
          Un feed verticale, stile reel, con tutti i media di una board di 4chan.
        </p>
      </header>

      <BoardForm />

      <BoardList title="Worksafe" boards={boards.filter((b) => b.sfw)} />
      <BoardList title="NSFW" boards={boards.filter((b) => !b.sfw)} />

      <p className="text-center text-xs text-neutral-500">
        Scorciatoie nel feed: ↑↓ naviga · Spazio autoplay · M audio · F schermo intero · D scarica · P vai al post ·
        +/− secondi · doppio tap zoom · Esc esci
      </p>
    </main>
  );
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
