"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchBoardMedia, fetchThreadMedia, HttpError, shuffled, type Media } from "@/lib/media";
import { Viewer } from "./viewer";

export type Source = { kind: "random"; board: string } | { kind: "thread"; board: string; op: string };

type Loaded = { items: Media[]; start: number; key: number };
type State =
  | { status: "loading"; done: number; total: number }
  | { status: "error"; message: string }
  | { status: "ready" };

export function Reel({ source }: { source: Source }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading", done: 0, total: 0 });
  const [list, setList] = useState<Loaded>({ items: [], start: 0, key: 0 });
  // lista del random e posizione, salvate quando si entra in un thread
  const [backTo, setBackTo] = useState<Loaded | null>(null);
  const [inThread, setInThread] = useState(source.kind === "thread");
  const threadRef = useRef<{ board: string; op: string } | null>(null);

  const board = source.board;
  const op = source.kind === "thread" ? source.op : null;

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      try {
        if (op) {
          const items = await fetchThreadMedia(board, op, ctrl.signal);
          if (!items.length) throw new Error("Nessun media in questo thread");
          threadRef.current = { board, op };
          setList({ items, start: 0, key: 0 });
        } else {
          const all = await fetchBoardMedia(
            board,
            (done, total) => setState({ status: "loading", done, total }),
            ctrl.signal,
          );
          if (!all.length) throw new Error("Nessun media trovato su questa board");
          setList({ items: shuffled(all), start: 0, key: 0 });
        }
        setState({ status: "ready" });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState({ status: "error", message: errorMessage(e) });
      }
    };
    run();
    return () => ctrl.abort();
  }, [board, op]);

  const close = useCallback(() => router.push("/"), [router]);

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
    />
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
