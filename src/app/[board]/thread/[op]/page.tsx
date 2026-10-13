import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ThreadView } from "@/components/thread-view";
import { isBoard, isThreadId } from "@/lib/fourchan";

export default function ThreadPage({ params }: PageProps<"/[board]/thread/[op]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: { params: PageProps<"/[board]/thread/[op]">["params"] }) {
  const { board, op } = await params;
  if (!isBoard(board) || !isThreadId(op)) notFound();
  return <ThreadView key={`${board}/${op}`} board={board} op={op} />;
}
