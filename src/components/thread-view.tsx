"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  fetchThreadView,
  HttpError,
  timeAgo,
  type ReplyCard,
  type ThreadData,
  type ThreadPost,
} from "@/lib/media";
import { CoverImage, MediaLabel } from "./cover-image";
import { Viewer } from "./reel/viewer";

// commenti mostrati in una card prima di "Mostra altri"
const COMMENTS_PREVIEW = 3;
const HIGHLIGHT_MS = 1600;

type State = { status: "loading" } | { status: "error"; message: string } | ({ status: "ready" } & ThreadData);

// Thread a card, sopra la pagina: l'OP, poi una card per ogni risposta al
// thread con dentro i commenti che la citano (>>no). Un tap su un media apre il
// reel dei media del thread da quel punto; il "back" del browser lo richiude.
// `onClose` di default torna alla lista dei thread della board.
export function ThreadView({ board, op, onClose }: { board: string; op: string; onClose?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  // media da cui è aperto il reel
  const [viewing, setViewing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [highlight, setHighlight] = useState<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mediaCount = useRef(0);

  const close = useCallback(() => (onClose ? onClose() : router.push(`/${board}`)), [onClose, router, board]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchThreadView(board, op, ctrl.signal)
      .then((data) => {
        mediaCount.current = data.media.length;
        setState({ status: "ready", ...data });
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setState({ status: "error", message: errorMessage(e) });
      });
    return () => ctrl.abort();
  }, [board, op]);

  // blocca lo scroll della pagina sotto: scorre solo il thread
  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
      clearTimeout(highlightTimer.current);
    };
  }, []);

  // il reel ha una sua voce nella cronologia: "back" lo chiude, "avanti" lo riapre
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const reel = e.state?.reel;
      setViewing(typeof reel === "number" ? reel : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openMedia = useCallback((i: number) => {
    window.history.pushState({ reel: i }, "");
    setViewing(i);
  }, []);
  const closeViewer = useCallback(() => window.history.back(), []);

  // a reel aperto Esc lo gestisce il viewer
  useEffect(() => {
    if (viewing != null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.ctrlKey && !e.metaKey && !e.altKey) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing, close]);

  // fine del reel: rilegge il thread per includere i nuovi post
  const refresh = useCallback(async () => {
    const data = await fetchThreadView(board, op);
    mediaCount.current = Math.max(mediaCount.current, data.media.length);
    setState({ status: "ready", ...data });
    return mediaCount.current;
  }, [board, op]);

  // click su >>no: porta al post citato (aprendo la sua card se serve) e lo evidenzia
  const root = state.status === "ready" ? state.root : null;
  const goTo = useCallback(
    (no: number) => {
      const card = root?.get(no);
      if (card != null && card !== no) {
        flushSync(() => setExpanded((s) => (s.has(card) ? s : new Set(s).add(card))));
      }
      document.getElementById(`p${no}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlight(no);
      clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    },
    [root],
  );

  const expand = useCallback((no: number) => setExpanded((s) => new Set(s).add(no)), []);

  const opNo = Number(op);
  const quoteProps = {
    opNo,
    known: (no: number) => no === opNo || !!root?.has(no),
    onQuote: goTo,
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-black text-white">
      <div className="mx-auto w-full max-w-2xl px-4 pb-16">
        <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
          <button onClick={close} className="text-neutral-400 hover:text-white" aria-label="Torna ai thread">
            ←
          </button>
          <h1 className="min-w-0 flex-1 truncate font-semibold">
            /{board}/{" "}
            <span className="font-normal text-neutral-400">
              {state.status === "ready" ? state.op.title || `Thread #${op}` : `Thread #${op}`}
            </span>
          </h1>
          {state.status === "ready" && state.media.length > 0 && (
            <button
              onClick={() => openMedia(0)}
              className="shrink-0 rounded-full border border-white/30 px-3.5 py-1.5 text-sm font-semibold transition-colors hover:bg-white/20"
            >
              ▶ Reel
            </button>
          )}
        </header>

        {state.status === "loading" && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        )}

        {state.status === "error" && (
          <div className="grid justify-items-center pt-24 text-center">
            <p className="text-red-300">{state.message}</p>
            <button onClick={close} className="mt-4 rounded-full bg-white/15 px-4 py-2 text-sm hover:bg-white/25">
              Torna ai thread
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <ul className="flex flex-col gap-4">
            <li>
              <article
                id={`p${state.op.no}`}
                className={`overflow-hidden rounded-2xl border bg-white/5 transition-colors ${
                  highlight === state.op.no ? "border-white/60" : "border-white/10"
                }`}
              >
                <PostHeader post={state.op} className="px-4 pt-3" />
                {state.op.title && <h2 className="px-4 pt-1 text-lg font-semibold leading-snug">{state.op.title}</h2>}
                {state.op.text && (
                  <PostText text={state.op.text} {...quoteProps} className="px-4 pt-1 text-neutral-200" />
                )}
                {state.op.file && (
                  <MediaButton onClick={() => openMedia(state.op.file!.media)}>
                    <CoverImage cover={state.op.file.cover} />
                  </MediaButton>
                )}
                <div className="flex gap-4 px-4 py-3 text-sm text-neutral-400">
                  <span>💬 {state.root.size}</span>
                  <span>🖼 {state.media.length}</span>
                </div>
              </article>
            </li>
            {state.cards.map((card) => (
              <li key={card.post.no}>
                <Card
                  card={card}
                  expanded={expanded.has(card.post.no)}
                  highlight={highlight}
                  onExpand={() => expand(card.post.no)}
                  onMedia={openMedia}
                  quoteProps={quoteProps}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {state.status === "ready" && viewing != null && (
        <Viewer items={state.media} initialIndex={viewing} onClose={closeViewer} onRefresh={refresh} />
      )}
    </div>
  );
}

type QuoteProps = { opNo: number; known: (no: number) => boolean; onQuote: (no: number) => void };

function Card({
  card: { post, comments },
  expanded,
  highlight,
  onExpand,
  onMedia,
  quoteProps,
}: {
  card: ReplyCard;
  expanded: boolean;
  highlight: number | null;
  onExpand: () => void;
  onMedia: (i: number) => void;
  quoteProps: QuoteProps;
}) {
  const shown = expanded ? comments : comments.slice(0, COMMENTS_PREVIEW);
  const hidden = comments.length - shown.length;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div id={`p${post.no}`} className={`pb-3 transition-colors ${highlight === post.no ? "bg-white/10" : ""}`}>
        <PostHeader post={post} className="px-4 pt-3" />
        {post.title && <h3 className="px-4 pt-1 font-semibold leading-snug">{post.title}</h3>}
        {post.text && <PostText text={post.text} {...quoteProps} className="px-4 pt-1 text-neutral-200" />}
        {post.file && (
          <MediaButton onClick={() => onMedia(post.file!.media)}>
            <CoverImage cover={post.file.cover} />
          </MediaButton>
        )}
      </div>

      {comments.length > 0 && (
        <div className="border-t border-white/10">
          {shown.map((c) => (
            <Comment key={c.no} post={c} highlight={highlight === c.no} onMedia={onMedia} quoteProps={quoteProps} />
          ))}
          {hidden > 0 && (
            <button
              onClick={onExpand}
              className="w-full px-4 py-3 text-left text-sm font-semibold text-neutral-400 hover:text-white"
            >
              Mostra {hidden === 1 ? "un altro commento" : `altri ${hidden} commenti`}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

// Commento dentro una card: miniatura a sinistra, testo a destra
function Comment({
  post,
  highlight,
  onMedia,
  quoteProps,
}: {
  post: ThreadPost;
  highlight: boolean;
  onMedia: (i: number) => void;
  quoteProps: QuoteProps;
}) {
  const { file } = post;
  return (
    <div
      id={`p${post.no}`}
      className={`flex gap-3 border-l-2 border-white/15 py-2.5 pl-3 pr-4 transition-colors ml-4 ${
        highlight ? "bg-white/10" : ""
      }`}
    >
      {file && (
        <button
          onClick={() => onMedia(file.media)}
          className="relative w-20 flex-none self-start overflow-hidden rounded-lg bg-black sm:w-24"
          style={{ aspectRatio: `${file.thumb.w} / ${file.thumb.h}` }}
          aria-label="Apri nel reel"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.thumb.url}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 size-full object-cover"
          />
          {(file.cover.video || file.cover.gif) && <MediaLabel video={!!file.cover.video} small />}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <PostHeader post={post} />
        {post.title && <p className="font-semibold">{post.title}</p>}
        {post.text && <PostText text={post.text} {...quoteProps} className="text-neutral-300" />}
      </div>
    </div>
  );
}

function PostHeader({ post, className = "" }: { post: ThreadPost; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs text-neutral-500 ${className}`}>
      <span className="truncate font-semibold text-emerald-400/90">{post.name}</span>
      <span>No.{post.no}</span>
      <span>·</span>
      <time dateTime={new Date(post.time * 1000).toISOString()} suppressHydrationWarning>
        {timeAgo(post.time)}
      </time>
    </div>
  );
}

function MediaButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mt-3 block w-full cursor-zoom-in" aria-label="Apri nel reel">
      {children}
    </button>
  );
}

// Testo del post come su 4chan: righe che iniziano con ">" in verde, i >>no
// sono link al post citato
function PostText({ text, opNo, known, onQuote, className = "" }: QuoteProps & { text: string; className?: string }) {
  return (
    <p className={`whitespace-pre-line break-words text-sm [overflow-wrap:anywhere] ${className}`}>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && "\n"}
          <span className={/^>(?!>)/.test(line) ? "text-lime-400/90" : undefined}>
            {line.split(/((?<!>)>>\d+)/).map((part, j) => {
              if (j % 2 === 0) return part;
              const no = Number(part.slice(2));
              if (!known(no)) {
                return (
                  <span key={j} className="text-sky-400/50" title="Post non presente in questo thread">
                    {part}
                  </span>
                );
              }
              return (
                <button key={j} onClick={() => onQuote(no)} className="text-sky-400 hover:underline">
                  {part}
                  {no === opNo && " (OP)"}
                </button>
              );
            })}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

function errorMessage(e: unknown) {
  if (e instanceof HttpError) return e.status === 404 ? "Thread non trovato" : "Impossibile contattare 4chan";
  if (e instanceof TypeError) return "Connessione non riuscita";
  return e instanceof Error ? e.message : "Errore sconosciuto";
}
