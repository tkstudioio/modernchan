import { fetchMedia, isBoard, isMediaFile } from "@/lib/fourchan";

// Il nome file contiene il timestamp di upload: il contenuto non cambia mai,
// quindi browser e CDN possono tenerlo in cache per sempre.
const IMMUTABLE = "public, max-age=31536000, immutable";
const PASS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

// Il video chiede `bytes=N-` (tutto il resto del file): si risponde con un
// blocco solo, così il browser scarica il file a pezzi, man mano che serve, e
// uno scorrimento veloce non lascia centinaia di MB in download. Un 206 più
// corto del richiesto è lecito. Senza Range (download del file) passa tutto.
const CHUNK = 2 * 1024 * 1024;

function capRange(range: string | null) {
  const m = range?.match(/^bytes=(\d+)-(\d*)$/);
  if (!m) return range;
  const start = Number(m[1]);
  const end = m[2] ? Math.min(Number(m[2]), start + CHUNK - 1) : start + CHUNK - 1;
  return `bytes=${start}-${end}`;
}

export async function GET(req: Request, ctx: RouteContext<"/api/[board]/media/[file]">) {
  const { board, file } = await ctx.params;
  if (!isBoard(board) || !isMediaFile(file)) {
    return Response.json({ error: "parametri non validi" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchMedia(board, file, capRange(req.headers.get("range")));
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
