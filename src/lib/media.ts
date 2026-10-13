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
  time?: number;
  name?: string;
  sub?: string;
  com?: string;
  filename?: string;
  ext?: string;
  tim?: number;
  w?: number;
  h?: number;
  tn_w?: number;
  tn_h?: number;
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

// Immagine di un post da mostrare in una card: preview piccola per le
// immagini, miniatura per GIF e video
export type Cover = { url: string; w: number; h: number; video: boolean; gif: boolean };

const CARD_PREVIEW_WIDTH = 640;
const hasMedia = (p: RawPost) => !!p.tim && !p.filedeleted && !!p.ext && MEDIA_EXT.has(p.ext);

function coverOf(board: string, p: RawPost): Cover | null {
  if (!hasMedia(p)) return null;
  return {
    url: PREVIEW_EXT.has(p.ext!)
      ? `/api/${board}/preview/${p.tim}${p.ext}?w=${CARD_PREVIEW_WIDTH}`
      : mediaUrl(board, `${p.tim}s.jpg`),
    w: p.w ?? 1,
    h: p.h ?? 1,
    video: p.ext === ".webm" || p.ext === ".mp4",
    gif: p.ext === ".gif",
  };
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
  cover: Cover | null; // immagine dell'OP
};

const SUMMARY_TEXT = 600; // caratteri: il resto non sta comunque nella card

export type CatalogPost = RawPost & { time: number; replies: number; images: number; sticky?: 1 };

export function catalogToSummaries(board: string, threads: CatalogPost[]): ThreadSummary[] {
  return threads.map((t) => ({
    no: t.no,
    title: htmlToText(t.sub),
    text: htmlToText(t.com).slice(0, SUMMARY_TEXT),
    time: t.time,
    replies: t.replies,
    media: t.images + (hasMedia(t) ? 1 : 0),
    sticky: !!t.sticky,
    cover: coverOf(board, t),
  }));
}

// Post di un thread, per la vista a card
export type ThreadPost = {
  no: number;
  time: number;
  name: string;
  title: string;
  text: string;
  file: {
    media: number; // indice fra i media del thread, per aprire il reel
    cover: Cover;
    thumb: { url: string; w: number; h: number };
  } | null;
};

// Una card: una risposta al thread e, sotto, i commenti che la citano (>>no),
// anche indirettamente, in ordine cronologico
export type ReplyCard = { post: ThreadPost; comments: ThreadPost[] };

export type ThreadData = {
  op: ThreadPost;
  cards: ReplyCard[];
  media: Media[];
  root: Map<number, number>; // post -> risposta della card che lo contiene
};

// `>>123`, ma non `>>>/g/123` (link ad altre board)
export const QUOTE = /(?<!>)>>(\d+)/g;

export function threadToView(board: string, op: string, posts: RawPost[]): ThreadData {
  const media = threadToMedia(board, op, posts);
  const mediaIdx = new Map(media.map((m, i) => [m.id, i]));
  const toPost = (p: RawPost): ThreadPost => {
    const cover = coverOf(board, p);
    return {
      no: p.no,
      time: p.time ?? 0,
      name: p.name || "Anonymous",
      title: htmlToText(p.sub),
      text: htmlToText(p.com),
      file: cover && {
        media: mediaIdx.get(`${board}/${p.tim}`) ?? 0,
        cover,
        thumb: { url: mediaUrl(board, `${p.tim}s.jpg`), w: p.tn_w ?? 1, h: p.tn_h ?? 1 },
      },
    };
  };

  const [head, ...replies] = posts;
  const cards: ReplyCard[] = [];
  const byNo = new Map<number, ReplyCard>();
  const root = new Map<number, number>();
  for (const r of replies) {
    const post = toPost(r);
    // decide la prima citazione di un post precedente; l'OP non conta, perché
    // citarlo è rispondere al thread
    const parent = [...post.text.matchAll(QUOTE)].map((m) => Number(m[1])).find((q) => q < r.no && root.has(q));
    const no = parent == null ? r.no : root.get(parent)!;
    if (parent == null) {
      const card = { post, comments: [] };
      cards.push(card);
      byNo.set(no, card);
    } else {
      byNo.get(no)!.comments.push(post);
    }
    root.set(r.no, no);
  }
  return { op: toPost(head), cards, media, root };
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

const getPosts = async (board: string, op: string, signal?: AbortSignal, priority?: RequestPriority) =>
  (await getJson<{ posts: RawPost[] }>(`/api/${board}/thread/${op}`, signal, priority)).posts;

export async function fetchThreadMedia(board: string, op: string, signal?: AbortSignal, priority?: RequestPriority) {
  return threadToMedia(board, op, await getPosts(board, op, signal, priority));
}

export async function fetchThreadView(board: string, op: string, signal?: AbortSignal) {
  return threadToView(board, op, await getPosts(board, op, signal));
}

export function timeAgo(unix: number) {
  const s = Math.max(0, Date.now() / 1000 - unix);
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  return `${Math.floor(s / 86400)} g fa`;
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
