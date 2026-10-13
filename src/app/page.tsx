import { BoardBrowser } from "@/components/board-browser";
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
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center gap-10 px-6 py-16">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Modernchan</h1>
        <p className="mt-3 text-neutral-400">
          Un feed verticale, stile reel, con tutti i media di una board di 4chan.
        </p>
      </header>

      <BoardBrowser boards={boards} />

      <p className="text-center text-xs text-neutral-500">
        Scorciatoie nel feed: ↑↓ naviga · Spazio autoplay · M audio · F schermo intero · D scarica · P vai al post ·
        +/− secondi · doppio tap zoom · Esc esci
      </p>
    </main>
  );
}
