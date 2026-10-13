import type { Media } from "@/lib/media";

type Props = {
  item: Media;
  open: boolean;
  onToggle: () => void;
  onOpenThread?: () => void;
};

// Info in basso, come nei reel: titolo e descrizione del thread, poi il testo
// del post del media mostrato.
export function ThreadCard({ item, open, onToggle, onOpenThread }: Props) {
  const { thread, postText } = item;
  const clamp = open ? "" : "line-clamp-2";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/50 to-transparent py-6 pl-4 pr-20 pt-16">
      <div className="max-w-xl">
        <div className="flex items-center gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-gradient-to-br from-amber-300 via-pink-500 to-violet-600 text-[11px] font-bold">
            /{thread.board}/
          </span>
          <button
            onClick={onOpenThread}
            disabled={!onOpenThread}
            title="Apri la galleria di questo thread"
            className="pointer-events-auto min-w-0 text-left font-semibold [overflow-wrap:anywhere] [text-shadow:0_1px_3px_#000] enabled:hover:underline"
          >
            {thread.title}
          </button>
        </div>
        {(thread.desc || postText) && (
          <div
            data-scroll
            onClick={onToggle}
            className={`pointer-events-auto mt-2 cursor-pointer space-y-2 text-sm [overflow-wrap:anywhere] [text-shadow:0_1px_3px_#000] ${
              open ? "max-h-[40vh] overflow-y-auto" : ""
            }`}
          >
            {thread.desc && <p className={`whitespace-pre-line text-neutral-300 ${clamp}`}>{thread.desc}</p>}
            {postText && (
              <p className={`whitespace-pre-line border-l-2 border-white/40 pl-2 text-white ${clamp}`}>{postText}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
