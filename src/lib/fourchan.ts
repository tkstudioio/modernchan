import { cacheLife } from "next/cache";
import type { CatalogPost } from "./media";

const API = "https://a.4cdn.org";

export type ThreadsPage = {
  page: number;
  threads: { no: number; last_modified: number; replies: number }[];
};

export type Post = {
  no: number;
  resto: number;
  sub?: string;
  com?: string;
  filename?: string;
  ext?: string;
  tim?: number;
  fsize?: number;
  filedeleted?: 1;
};

export class UpstreamError extends Error {
  constructor(public status: number) {
    super(`4chan API ha risposto ${status}`);
  }
}

export const isBoard = (v: string) => /^[a-z0-9]{1,10}$/i.test(v);
export const isThreadId = (v: string) => /^\d{1,12}$/.test(v);

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new UpstreamError(res.status);
  return res.json();
}

// Durata della cache di thread e liste di thread: anche la pagina della board e
// le risposte /api la usano, quindi è il ritardo massimo con cui si vede 4chan.
export const THREADS_TTL = 600;
const threadsLife = { stale: 300, revalidate: THREADS_TTL, expire: 3600 };

// Gli errori non vengono mai messi in cache: lanciare fa saltare il salvataggio.
export async function getThreadList(board: string) {
  "use cache";
  cacheLife(threadsLife);
  return getJson<ThreadsPage[]>(`/${board}/threads.json`);
}

export async function getThread(board: string, op: string) {
  "use cache";
  cacheLife(threadsLife);
  return getJson<{ posts: Post[] }>(`/${board}/thread/${op}.json`);
}

// Una sola richiesta per tutti i thread della board, con l'OP di ognuno.
export async function getCatalog(board: string) {
  "use cache";
  cacheLife(threadsLife);
  return getJson<{ page: number; threads: CatalogPost[] }[]>(`/${board}/catalog.json`);
}

export type Board = { id: string; name: string; sfw: boolean };

// usato solo se 4chan non risponde
const FALLBACK_BOARDS: Board[] = [
  { id: "g", name: "Technology", sfw: true },
  { id: "a", name: "Anime & Manga", sfw: true },
  { id: "v", name: "Video Games", sfw: true },
  { id: "wg", name: "Wallpapers/General", sfw: true },
  { id: "wsg", name: "Worksafe GIF", sfw: true },
  { id: "ck", name: "Food & Cooking", sfw: true },
  { id: "diy", name: "Do It Yourself", sfw: true },
  { id: "sci", name: "Science & Math", sfw: true },
  { id: "mu", name: "Music", sfw: true },
  { id: "fit", name: "Fitness", sfw: true },
  { id: "tv", name: "Television & Film", sfw: true },
  { id: "gif", name: "Adult GIF", sfw: false },
];

// L'elenco delle board cambia di rado. Se 4chan non risponde si usa quello di
// riserva, ma solo per pochi minuti: la homepage (statica) dura quanto questa
// cache e non deve restare per un giorno con l'elenco ridotto.
export async function getBoards(): Promise<Board[]> {
  "use cache";
  try {
    const data = await getJson<{ boards: { board: string; title: string; ws_board: number }[] }>("/boards.json");
    if (!data) throw new UpstreamError(404);
    cacheLife("days");
    return data.boards.map((b) => ({ id: b.board, name: b.title, sfw: b.ws_board === 1 }));
  } catch {
    cacheLife("minutes");
    return FALLBACK_BOARDS;
  }
}

const MEDIA = "https://i.4cdn.org";

// `{tim}.{ext}` oppure la thumbnail `{tim}s.jpg`. `tim` è un timestamp unico per file.
export const isMediaFile = (v: string) =>
  /^\d{10,20}s?\.(jpe?g|png|gif|webp|webm|mp4)$/i.test(v);

// Immagini statiche per cui esiste la preview ridimensionata (niente GIF e video).
export const isPreviewFile = (v: string) => /^\d{10,20}\.(jpe?g|png|webp)$/i.test(v);

// Streaming con supporto a Range (necessario per seek e Safari sui video).
export function fetchMedia(board: string, file: string, range: string | null) {
  return fetch(`${MEDIA}/${board}/${file}`, {
    headers: range ? { Range: range } : undefined,
  });
}
