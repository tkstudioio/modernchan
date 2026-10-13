import { fetchMedia, isBoard, isMediaFile } from "@/lib/fourchan";

// Il nome file contiene il timestamp di upload: il contenuto non cambia mai,
// quindi browser e CDN possono tenerlo in cache per sempre.
const IMMUTABLE = "public, max-age=31536000, immutable";
const PASS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

export async function GET(req: Request, ctx: RouteContext<"/api/[board]/media/[file]">) {
  const { board, file } = await ctx.params;
  if (!isBoard(board) || !isMediaFile(file)) {
    return Response.json({ error: "parametri non validi" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchMedia(board, file, req.headers.get("range"));
  } catch {
    return Response.json({ error: "errore nel contattare 4chan" }, { status: 502 });
  }

  if (upstream.status === 404) return Response.json({ error: "file non trovato" }, { status: 404 });
  if (!upstream.ok) return Response.json({ error: "errore nel contattare 4chan" }, { status: 502 });

  const headers = new Headers({ "Cache-Control": IMMUTABLE });
  for (const h of PASS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
