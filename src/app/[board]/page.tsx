import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Reel } from "@/components/reel/reel";
import { isBoard } from "@/lib/fourchan";

export default function BoardPage({ params }: PageProps<"/[board]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <BoardReel params={params} />
    </Suspense>
  );
}

async function BoardReel({ params }: { params: PageProps<"/[board]">["params"] }) {
  const { board } = await params;
  if (!isBoard(board)) notFound();
  return <Reel key={board} source={{ kind: "random", board }} />;
}
