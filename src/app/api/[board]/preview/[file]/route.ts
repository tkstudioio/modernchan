import sharp from "sharp";
import { fetchMedia, isBoard, isPreviewFile } from "@/lib/fourchan";

// Come per i media: il file originale non cambia mai, quindi nemmeno la preview.
const IMMUTABLE = "public, max-age=31536000, immutable";
// lato massimo della preview: abbastanza per uno schermo, molto meno dell'originale
const SIZE = 1440;
const QUALITY = 70;

export async function GET(_req: Request, ctx: RouteContext<"/api/[board]/preview/[file]">) {
  const { board, file } = await ctx.params;
  if (!isBoard(board) || !isPreviewFile(file)) {
    return Response.json({ error: "parametri non validi" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchMedia(board, file, null);
  } catch {
    return Response.json({ error: "errore nel contattare 4chan" }, { status: 502 });
  }
  if (upstream.status === 404) return Response.json({ error: "file non trovato" }, { status: 404 });
  if (!upstream.ok) return Response.json({ error: "errore nel contattare 4chan" }, { status: 502 });

  const original = Buffer.from(await upstream.arrayBuffer());
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";

  let preview: Buffer | null = null;
  try {
    preview = await sharp(original)
      .rotate()
      .resize(SIZE, SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
  } catch {
    // immagine che sharp non sa leggere: si serve l'originale
  }

  // immagini già piccole: la preview potrebbe pesare più dell'originale
  const [body, contentType] = preview && preview.length < original.length ? [preview, "image/webp"] : [original, type];
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": contentType, "Cache-Control": IMMUTABLE },
  });
}
