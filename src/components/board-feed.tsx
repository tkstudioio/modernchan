"use client";

import { usePathname } from "next/navigation";
import type { ThreadSummary } from "@/lib/media";
import { Reel } from "./reel/reel";

// Lista dei thread della board, a card. Aprire un thread non cambia pagina: si
// aggiorna solo l'URL (/{board}/thread/{op}) e il reel compare sopra la lista,
// che resta montata e mantiene lo scroll. Il "back" del browser lo richiude.
export function BoardFeed({ board, threads }: { board: string; threads: ThreadSummary[] }) {
  const pathname = usePathname();
  const open = pathname.match(new RegExp(`^/${board}/thread/(\\d+)$`))?.[1];

  const openThread = (e: React.MouseEvent, no: number) => {
    // ctrl/cmd-click e simili: lascia fare al browser (nuova scheda)
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.history.pushState(null, "", `/${board}/thread/${no}`);
  };

  return (
    <>
      <ul className="flex flex-col gap-4">
        {threads.map((t) => (
          <li key={t.no}>
            <ThreadCard board={board} thread={t} onOpen={(e) => openThread(e, t.no)} />
          </li>
        ))}
      </ul>

      {open && (
        <Reel key={open} source={{ kind: "thread", board, op: open }} onClose={() => window.history.back()} />
      )}
    </>
  );
}

function ThreadCard({
  board,
  thread: t,
  onOpen,
}: {
  board: string;
  thread: ThreadSummary;
  onOpen: (e: React.MouseEvent) => void;
}) {
  return (
    <a
      href={`/${board}/thread/${t.no}`}
      onClick={onOpen}
      className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-colors hover:border-white/25"
    >
      <div className="flex items-center gap-2 px-4 pt-3 text-xs text-neutral-500">
        {t.sticky && <span title="Thread fissato">📌</span>}
        <span>No.{t.no}</span>
        <span>·</span>
        <time dateTime={new Date(t.time * 1000).toISOString()} suppressHydrationWarning>
          {timeAgo(t.time)}
        </time>
      </div>

      {t.title && <h2 className="px-4 pt-1 text-lg font-semibold leading-snug">{t.title}</h2>}
      {t.text && (
        <p className="line-clamp-4 whitespace-pre-line break-words px-4 pt-1 text-sm text-neutral-300">{t.text}</p>
      )}

      {t.cover && (
        <div className="relative mt-3 max-h-[70vh] w-full bg-black" style={{ aspectRatio: `${t.cover.w} / ${t.cover.h}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.cover.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-contain"
          />
          {(t.cover.video || t.cover.gif) && (
            <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold">
              {t.cover.video ? "▶ Video" : "GIF"}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-4 px-4 py-3 text-sm text-neutral-400">
        <span>💬 {t.replies}</span>
        <span>🖼 {t.media}</span>
      </div>
    </a>
  );
}

function timeAgo(unix: number) {
  const s = Math.max(0, Date.now() / 1000 - unix);
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  return `${Math.floor(s / 86400)} g fa`;
}
