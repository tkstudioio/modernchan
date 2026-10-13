import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardFeed } from "@/components/board-feed";
import { getBoards, getCatalog, isBoard } from "@/lib/fourchan";
import { catalogToSummaries } from "@/lib/media";

export default function BoardPage({ params }: PageProps<"/[board]">) {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <Board params={params} />
    </Suspense>
  );
}

async function Board({ params }: { params: PageProps<"/[board]">["params"] }) {
  const { board } = await params;
  if (!isBoard(board)) notFound();

  const [pages, boards] = await Promise.all([getCatalog(board), getBoards().catch(() => [])]);
  if (!pages) notFound();
  const threads = catalogToSummaries(
    board,
    pages.flatMap((p) => p.threads),
  );
  const name = boards.find((b) => b.id === board)?.name;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-neutral-400 hover:text-white" aria-label="Torna alla home">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-semibold">
          /{board}/ {name && <span className="font-normal text-neutral-400">{name}</span>}
        </h1>
        <Link
          href={`/${board}/random`}
          className="shrink-0 rounded-full border border-white/30 px-3.5 py-1.5 text-sm font-semibold transition-colors hover:bg-white/20"
        >
          🎲 Random
        </Link>
      </header>

      <BoardFeed board={board} threads={threads} />
    </main>
  );
}

function FeedSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-16">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/5" />
      ))}
    </main>
  );
}
