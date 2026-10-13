import { getThread, isBoard, isThreadId, THREADS_TTL, UpstreamError } from "@/lib/fourchan";

// La CDN tiene la risposta quanto la cache del server; il browser non la tiene.
const CDN_CACHE = `public, s-maxage=${THREADS_TTL}, stale-while-revalidate=300`;

export async function GET(_req: Request, ctx: RouteContext<"/api/[board]/thread/[op]">) {
  const { board, op } = await ctx.params;
  if (!isBoard(board) || !isThreadId(op)) {
    return Response.json({ error: "parametri non validi" }, { status: 400 });
  }

  try {
    const data = await getThread(board, op);
    if (!data) return Response.json({ error: "thread non trovato" }, { status: 404 });
    return Response.json(data, { headers: { "Cache-Control": CDN_CACHE } });
  } catch (e) {
    const status = e instanceof UpstreamError ? 502 : 500;
    return Response.json({ error: "errore nel contattare 4chan" }, { status });
  }
}
