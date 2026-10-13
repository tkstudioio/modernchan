import type { Cover } from "@/lib/media";

// Immagine grande di una card, con le proporzioni del file e l'etichetta per GIF e video.
export function CoverImage({ cover }: { cover: Cover }) {
  return (
    <div className="relative max-h-[70vh] w-full bg-black" style={{ aspectRatio: `${cover.w} / ${cover.h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover.url}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full object-contain"
      />
      {(cover.video || cover.gif) && <MediaLabel video={cover.video} />}
    </div>
  );
}

export function MediaLabel({ video, small }: { video: boolean; small?: boolean }) {
  return (
    <span
      className={`absolute rounded-full bg-black/70 font-semibold ${
        small ? "left-1 top-1 px-1.5 py-0.5 text-[10px]" : "left-3 top-3 px-2.5 py-1 text-xs"
      }`}
    >
      {video ? "▶ Video" : "GIF"}
    </span>
  );
}
