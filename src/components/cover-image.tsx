"use client";

import { useEffect, useRef } from "react";
import type { Cover } from "@/lib/media";

// Immagine grande di una card, con le proporzioni del file e l'etichetta per
// GIF e video. I video partono muti quando sono visibili e si fermano quando
// escono dallo schermo.
export function CoverImage({ cover }: { cover: Cover }) {
  return (
    <div className="relative max-h-[70vh] w-full bg-black" style={{ aspectRatio: `${cover.w} / ${cover.h}` }}>
      {/* anche per i video: `poster` si scarica subito, un'img lazy solo vicino allo schermo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover.url}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full object-contain"
      />
      {/* senza poster il video resta trasparente finché non ha un fotogramma */}
      {cover.video && <CardVideo src={cover.video} />}
      {(cover.video || cover.gif) && <MediaLabel video={!!cover.video} />}
    </div>
  );
}

// quota del video che deve essere sullo schermo per farlo partire
const VISIBLE = 0.6;

function CardVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          // src solo alla prima comparsa: i video mai visti non si scaricano
          if (!v.getAttribute("src")) v.src = src;
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { threshold: VISIBLE },
    );
    io.observe(v);
    return () => {
      io.disconnect();
      // interrompe il download quando la card sparisce
      v.pause();
      v.removeAttribute("src");
      v.load();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      disablePictureInPicture
      preload="none"
      className="absolute inset-0 size-full object-contain"
    />
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
