import { cacheLife } from "next/cache";

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

// Gli errori non vengono mai messi in cache: lanciare fa saltare il salvataggio.
export async function getThreadList(board: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  return getJson<ThreadsPage[]>(`/${board}/threads.json`);
}

export async function getThread(board: string, op: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  return getJson<{ posts: Post[] }>(`/${board}/thread/${op}.json`);
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
