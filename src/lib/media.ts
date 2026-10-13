// Tipi e helper lato client per i media di 4chan. I dati arrivano dalle route
// /api/... di Modernchan, mai direttamente da 4chan.

export type ThreadInfo = {
  no: string;
  board: string;
  title: string;
  desc: string;
};

export type Media = {
  id: string;
  src: string; // file originale, in piena qualità
  preview: string; // versione leggera da mostrare nel reel (per GIF e video coincide con src)
  thumb: string;
  video: boolean;
  name: string;
  postUrl: string;
  postText: string; // commento del post del media (vuoto per l'OP: coincide con la descrizione)
  thread: ThreadInfo;
};

type RawPost = {
  no: number;
  sub?: string;
  com?: string;
  filename?: string;
  ext?: string;
  tim?: number;
  filedeleted?: 1;
};

const MEDIA_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".webm", ".mp4"]);
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

// HTML dei commenti 4chan -> testo semplice (con a capo)
export function htmlToText(html?: string) {
  return (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .trim();
}

export const mediaUrl = (board: string, file: string) => `/api/${board}/media/${file}`;
const PREVIEW_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function threadToMedia(board: string, op: string, posts: RawPost[]): Media[] {
  const head = posts[0];
  const thread: ThreadInfo = {
    no: op,
    board,
    title: htmlToText(head?.sub) || `Thread #${op}`,
    desc: htmlToText(head?.com),
  };
  const out: Media[] = [];
  for (const p of posts) {
    if (!p.tim || p.filedeleted || !p.ext || !MEDIA_EXT.has(p.ext)) continue;
    const src = mediaUrl(board, `${p.tim}${p.ext}`);
    out.push({
      id: `${board}/${p.tim}`,
      src,
      preview: PREVIEW_EXT.has(p.ext) ? `/api/${board}/preview/${p.tim}${p.ext}` : src,
      thumb: mediaUrl(board, `${p.tim}s.jpg`),
      video: p.ext === ".webm" || p.ext === ".mp4",
      name: (p.filename ?? String(p.tim)) + p.ext,
      postUrl: `https://boards.4chan.org/${board}/thread/${op}#p${p.no}`,
      postText: String(p.no) === op ? "" : htmlToText(p.com),
      thread,
    });
  }
  return out;
}

// Thread nella lista della board (card stile Reddit)
export type ThreadSummary = {
  no: number;
  title: string;
  text: string;
  time: number; // unix, secondi
  replies: number;
  media: number; // file nel thread, OP compreso
  sticky: boolean;
  // immagine dell'OP: preview piccola per le immagini, miniatura per GIF e video
  cover: { url: string; w: number; h: number; video: boolean; gif: boolean } | null;
};

const CARD_PREVIEW_WIDTH = 640;
const SUMMARY_TEXT = 600; // caratteri: il resto non sta comunque nella card

export type CatalogPost = RawPost & { time: number; w?: number; h?: number; replies: number; images: number; sticky?: 1 };

export function catalogToSummaries(board: string, threads: CatalogPost[]): ThreadSummary[] {
  return threads.map((t) => {
    const hasFile = !!t.tim && !t.filedeleted && !!t.ext && MEDIA_EXT.has(t.ext);
    const still = hasFile && PREVIEW_EXT.has(t.ext!);
    return {
      no: t.no,
      title: htmlToText(t.sub),
      text: htmlToText(t.com).slice(0, SUMMARY_TEXT),
      time: t.time,
      replies: t.replies,
      media: t.images + (hasFile ? 1 : 0),
      sticky: !!t.sticky,
      cover: hasFile
        ? {
            url: still
              ? `/api/${board}/preview/${t.tim}${t.ext}?w=${CARD_PREVIEW_WIDTH}`
              : mediaUrl(board, `${t.tim}s.jpg`),
            w: t.w ?? 1,
            h: t.h ?? 1,
            video: t.ext === ".webm" || t.ext === ".mp4",
            gif: t.ext === ".gif",
          }
        : null,
    };
  });
}

// Fisher-Yates: ogni media compare una sola volta, quindi nessuna ripetizione
export function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Inserisce `add` in posizioni casuali da `from` in poi: la parte prima di
// `from` (già vista o in visione) non si sposta.
export function insertRandom<T>(arr: T[], add: T[], from: number): T[] {
  const a = arr.slice();
  const lo = Math.min(Math.max(0, from), a.length);
  for (const x of add) a.splice(lo + Math.floor(Math.random() * (a.length - lo + 1)), 0, x);
  return a;
}

export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

async function getJson<T>(url: string, signal?: AbortSignal, priority?: RequestPriority): Promise<T> {
  const r = await fetch(url, { signal, priority });
  if (!r.ok) throw new HttpError(r.status);
  return r.json();
}

export async function fetchThreadMedia(board: string, op: string, signal?: AbortSignal, priority?: RequestPriority) {
  const data = await getJson<{ posts: RawPost[] }>(`/api/${board}/thread/${op}`, signal, priority);
  return threadToMedia(board, op, data.posts);
}

// Tutti i media della board: si leggono tutti i thread (6 alla volta) e il
// risultato resta in cache per 5 minuti per riaperture rapide.
const BOARD_TTL = 5 * 60 * 1000;
const BOARD_WORKERS = 6;
const boardCache = new Map<string, { time: number; list: Media[] }>();

type BoardCallbacks = {
  // media di ogni thread appena arrivano, prima del relativo onProgress
  onMedia: (items: Media[]) => void;
  onProgress: (done: number, total: number) => void;
  // prima di ogni thread: può attendere (per lasciare la banda ai media) o
  // restituire false per chiudere quel worker
  beforeFetch?: (worker: number) => Promise<boolean>;
};

export async function fetchBoardMedia(
  board: string,
  { onMedia, onProgress, beforeFetch }: BoardCallbacks,
  signal?: AbortSignal,
) {
  const hit = boardCache.get(board);
  if (hit && Date.now() - hit.time < BOARD_TTL) {
    onMedia(hit.list);
    onProgress(1, 1);
    return hit.list;
  }

  const pages = await getJson<{ threads: { no: number }[] }[]>(`/api/${board}/threads`, signal);
  const threads = pages.flatMap((pg) => pg.threads);
  const list: Media[] = [];
  let next = 0;
  let done = 0;
  onProgress(0, threads.length);

  const worker = async (_: unknown, id: number) => {
    while (next < threads.length) {
      if (beforeFetch && !(await beforeFetch(id))) return;
      if (next >= threads.length) return; // finiti durante l'attesa
      const t = threads[next++];
      try {
        // priorità bassa: i media in visione passano avanti
        const items = await fetchThreadMedia(board, String(t.no), signal, "low");
        list.push(...items);
        if (items.length) onMedia(items);
      } catch {
        if (signal?.aborted) return; // annullato: si interrompe
        // thread sparito nel frattempo: lo salta
      }
      onProgress(++done, threads.length);
    }
  };
  await Promise.all(Array.from({ length: BOARD_WORKERS }, worker));
  signal?.throwIfAborted();

  boardCache.set(board, { time: Date.now(), list });
  return list;
}
