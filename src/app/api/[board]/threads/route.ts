import { getThreadList, isBoard, UpstreamError } from "@/lib/fourchan";

export async function GET(_req: Request, ctx: RouteContext<"/api/[board]/threads">) {
  const { board } = await ctx.params;
  if (!isBoard(board)) return Response.json({ error: "board non valida" }, { status: 400 });

  try {
    const data = await getThreadList(board);
    if (!data) return Response.json({ error: "board non trovata" }, { status: 404 });
    return Response.json(data);
  } catch (e) {
    const status = e instanceof UpstreamError ? 502 : 500;
    return Response.json({ error: "errore nel contattare 4chan" }, { status });
  }
}
