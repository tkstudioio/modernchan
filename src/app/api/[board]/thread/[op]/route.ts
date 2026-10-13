import { getThread, isBoard, isThreadId, UpstreamError } from "@/lib/fourchan";

export async function GET(_req: Request, ctx: RouteContext<"/api/[board]/thread/[op]">) {
  const { board, op } = await ctx.params;
  if (!isBoard(board) || !isThreadId(op)) {
    return Response.json({ error: "parametri non validi" }, { status: 400 });
  }

  try {
    const data = await getThread(board, op);
    if (!data) return Response.json({ error: "thread non trovato" }, { status: 404 });
    return Response.json(data);
  } catch (e) {
    const status = e instanceof UpstreamError ? 502 : 500;
    return Response.json({ error: "errore nel contattare 4chan" }, { status });
  }
}
