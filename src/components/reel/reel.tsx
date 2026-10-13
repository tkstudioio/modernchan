"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchBoardMedia, fetchThreadMedia, HttpError, insertRandom, shuffled, type Media } from "@/lib/media";
import { Viewer } from "./viewer";

export type Source = { kind: "random"; board: string } | { kind: "thread"; board: string; op: string };

// thread letti prima di mostrare il random; il resto continua in background
const MIN_THREADS = 3;
// thread scaricati in parallelo mentre il viewer è aperto
const BACKGROUND_WORKERS = 2;

type Loaded = { items: Media[]; start: number; key: number };
type Progress = { done: number; total: number };
type State =
  | ({ status: "loading" } & Progress)
  | { status: "error"; message: string }
  | { status: "ready" };

export function Reel({ source }: { source: Source }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading", done: 0, total: 0 });
  const [list, setList] = useState<Loaded>({ items: [], start: 0, key: 0 });
  // lista del random e posizione, salvate quando si entra in un thread
  const [backTo, setBackTo] = useState<Loaded | null>(null);
  const [inThread, setInThread] = useState(source.kind === "thread");
  // caricamento dei thread ancora in corso a viewer già aperto
  const [background, setBackground] = useState<Progress | null>(null);
  const threadRef = useRef<{ board: string; op: string } | null>(null);
  const posRef = useRef(0); // media in visione nel viewer
  const backToRef = useRef(backTo);
  useEffect(() => {
    backToRef.current = backTo;
  }, [backTo]);

  // media in visione ancora in download: il caricamento dei thread aspetta
  const mediaBusy = useRef(false);
  const idleWaiters = useRef<(() => void)[]>([]);
  const wakeWaiters = useCallback(() => {
    for (const fn of idleWaiters.current.splice(0)) fn();
  }, []);
  const setMediaBusy = useCallback(
    (busy: boolean) => {
      mediaBusy.current = busy;
      if (!busy) wakeWaiters();
    },
    [wakeWaiters],
  );

  const board = source.board;
  const op = source.kind === "thread" ? source.op : null;

  useEffect(() => {
    const ctrl = new AbortController();
    ctrl.signal.addEventListener("abort", wakeWaiters);

    // media arrivati a viewer aperto: finiscono a caso fra quelli non ancora visti,
    // nella lista del random (che è in `backTo` se si sta guardando un thread)
    const add = (items: Media[]) => {
      if (backToRef.current) setBackTo((b) => b && { ...b, items: insertRandom(b.items, items, b.start + 2) });
      else setList((l) => ({ ...l, items: insertRandom(l.items, items, posRef.current + 2) }));
    };

    const loadBoard = async () => {
      let pending: Media[] = [];
      let shown = false;
      const show = () => {
        shown = true;
        mediaBusy.current = true; // il primo media parte ora, prima che il viewer lo segnali
        setList({ items: shuffled(pending), start: 0, key: 0 });
        setState({ status: "ready" });
        pending = [];
      };
      const all = await fetchBoardMedia(
        board,
        {
          onMedia: (items) => (shown ? add(items) : pending.push(...items)),
          onProgress: (done, total) => {
            if (!shown && pending.length && (done >= MIN_THREADS || done === total)) show();
            if (shown) setBackground(done < total ? { done, total } : null);
            else setState({ status: "loading", done, total });
          },
          // a viewer aperto la banda va prima al media in visione: pochi worker,
          // e solo quando il media è scaricato
          beforeFetch: async (worker) => {
            if (!shown) return true;
            if (worker >= BACKGROUND_WORKERS) return false;
            while (mediaBusy.current && !ctrl.signal.aborted) {
              await new Promise<void>((r) => idleWaiters.current.push(r));
            }
            return !ctrl.signal.aborted;
          },
        },
        ctrl.signal,
      );
      setBackground(null);
      if (!all.length) throw new Error("Nessun media trovato su questa board");
    };

    const run = async () => {
      try {
        if (op) {
          const items = await fetchThreadMedia(board, op, ctrl.signal);
          if (!items.length) throw new Error("Nessun media in questo thread");
          threadRef.current = { board, op };
          setList({ items, start: 0, key: 0 });
          setState({ status: "ready" });
        } else {
          await loadBoard();
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState({ status: "error", message: errorMessage(e) });
      }
    };
    run();
    return () => ctrl.abort();
  }, [board, op, wakeWaiters]);

  const close = useCallback(() => router.push("/"), [router]);
  const trackIndex = useCallback((i: number) => {
    posRef.current = i;
  }, []);

  // click sul titolo: galleria del thread del media corrente, partendo da quel media
  const openThread = useCallback(
    async (item: Media, idx: number) => {
      try {
        const items = await fetchThreadMedia(item.thread.board, item.thread.no);
        if (!items.length) return;
        if (source.kind === "random" && !backTo) setBackTo({ ...list, start: idx });
        threadRef.current = { board: item.thread.board, op: item.thread.no };
        setList((l) => ({
          items,
          start: Math.max(0, items.findIndex((m) => m.id === item.id)),
          key: l.key + 1,
        }));
        setInThread(true);
      } catch {}
    },
    [backTo, list, source.kind],
  );

  const back = useCallback(() => {
    if (!backTo) return;
    setList((l) => ({ ...backTo, key: l.key + 1 }));
    setBackTo(null);
    setInThread(source.kind === "thread");
  }, [backTo, source.kind]);

  // fine del thread: rilegge i media per includere i nuovi post
  const refresh = useCallback(async () => {
    const t = threadRef.current;
    if (!t) return list.items.length;
    const items = await fetchThreadMedia(t.board, t.op);
    if (items.length > list.items.length) setList((l) => ({ ...l, items }));
    return Math.max(items.length, list.items.length);
  }, [list.items.length]);

  if (state.status === "error") {
    return (
      <Centered>
        <p className="text-red-300">{state.message}</p>
        <button onClick={close} className="mt-4 rounded-full bg-white/15 px-4 py-2 text-sm hover:bg-white/25">
          Torna alla home
        </button>
      </Centered>
    );
  }

  if (state.status === "loading") {
    const pct = state.total ? (state.done / state.total) * 100 : 0;
    return (
      <Centered>
        <p className="text-lg">🎲 {op ? `Thread #${op}` : `/${board}/`}</p>
        {!op && (
          <>
            <div className="mt-4 h-1 w-56 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-white transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm tabular-nums text-neutral-400">
              {state.total ? `${state.done}/${state.total} thread` : "Carico i thread…"}
            </p>
          </>
        )}
      </Centered>
    );
  }

  return (
    <Viewer
      key={list.key}
      items={list.items}
      initialIndex={list.start}
      onClose={close}
      onOpenThread={source.kind === "random" ? openThread : undefined}
      onBack={backTo ? back : undefined}
      onRefresh={inThread ? refresh : undefined}
      onIndexChange={trackIndex}
      onBusyChange={setMediaBusy}
      badge={background && <LoadingBadge {...background} />}
    />
  );
}

// avanzamento del caricamento in background, in alto a destra nel viewer
function LoadingBadge({ done, total }: Progress) {
  return (
    <div
      className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs tabular-nums backdrop-blur"
      title="Altri thread in caricamento"
    >
      <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      {done}/{total} thread
    </div>
  );
}

function errorMessage(e: unknown) {
  if (e instanceof HttpError) return e.status === 404 ? "Board o thread non trovato" : "Impossibile contattare 4chan";
  if (e instanceof TypeError) return "Connessione non riuscita";
  return e instanceof Error ? e.message : "Errore sconosciuto";
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 grid place-content-center justify-items-center bg-black text-center">{children}</div>;
}
