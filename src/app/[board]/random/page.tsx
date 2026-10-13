import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Reel } from "@/components/reel/reel";
import { isBoard } from "@/lib/fourchan";

// Reel casuale con i media di tutti i thread della board.
export default function RandomPage({ params }: PageProps<"/[board]/random">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <RandomReel params={params} />
    </Suspense>
  );
}

async function RandomReel({ params }: { params: PageProps<"/[board]/random">["params"] }) {
  const { board } = await params;
  if (!isBoard(board)) notFound();
  return <Reel key={board} board={board} />;
}
