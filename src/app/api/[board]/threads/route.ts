import { getThreadList, isBoard, THREADS_TTL, UpstreamError } from "@/lib/fourchan";

// La CDN tiene la risposta quanto la cache del server; il browser non la tiene.
const CDN_CACHE = `public, s-maxage=${THREADS_TTL}, stale-while-revalidate=300`;

export async function GET(_req: Request, ctx: RouteContext<"/api/[board]/threads">) {
  const { board } = await ctx.params;
  if (!isBoard(board)) return Response.json({ error: "board non valida" }, { status: 400 });

  try {
    const data = await getThreadList(board);
    if (!data) return Response.json({ error: "board non trovata" }, { status: 404 });
    return Response.json(data, { headers: { "Cache-Control": CDN_CACHE } });
  } catch (e) {
    const status = e instanceof UpstreamError ? 502 : 500;
    return Response.json({ error: "errore nel contattare 4chan" }, { status });
  }
}
