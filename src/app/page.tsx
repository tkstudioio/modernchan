import { BoardBrowser } from "@/components/board-browser";
import { getBoards } from "@/lib/fourchan";

export default async function Home() {
  const boards = await getBoards();

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
