import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Reel } from "@/components/reel/reel";
import { isBoard, isThreadId } from "@/lib/fourchan";

export default function ThreadPage({ params }: PageProps<"/[board]/thread/[op]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <ThreadReel params={params} />
    </Suspense>
  );
}

async function ThreadReel({ params }: { params: PageProps<"/[board]/thread/[op]">["params"] }) {
  const { board, op } = await params;
  if (!isBoard(board) || !isThreadId(op)) notFound();
  return <Reel key={`${board}/${op}`} source={{ kind: "thread", board, op }} />;
}
