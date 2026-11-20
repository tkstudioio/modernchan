"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Media } from "@/lib/media";
import {
  ArrowLeftIcon,
  CloseIcon,
  DownloadIcon,
  ExpandIcon,
  ExternalIcon,
  PauseIcon,
  PlayIcon,
  VolumeIcon,
  VolumeOffIcon,
} from "./icons";
import { Stage } from "./stage";
import { ThreadCard } from "./thread-card";

const WHEEL_THROTTLE = 450;
const SWIPE_THRESHOLD = 50;
const SLIDE_MS = 260;
const TAP_SLOP = 8; // px prima che un tocco diventi un trascinamento

type Props = {
  items: Media[];
  initialIndex?: number;
  onClose: () => void;
  onOpenThread?: (item: Media, index: number) => void;
  onBack?: () => void;
  // chiamata in fondo alla lista: ricarica il thread e restituisce il nuovo numero di media
  onRefresh?: () => Promise<number>;
  onIndexChange?: (index: number) => void;
  // true finché il media in visione è in download
  onBusyChange?: (busy: boolean) => void;
  badge?: React.ReactNode; // in alto a destra, nascosto con il resto della UI
};

export function Viewer({
  items,
  initialIndex = 0,
  onClose,
  onOpenThread,
  onBack,
  onRefresh,
  onIndexChange,
  onBusyChange,
  badge,
}: Props) {
  const [idx, setIdx] = useState(initialIndex < items.length ? initialIndex : 0);
  // autoplay: a fine video si passa al successivo (le immagini non avanzano da
  // sole); fermo, il video riparte da capo
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true); // audio disattivato di default (solo per la sessione)
  const [cardOpen, setCardOpen] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // modalità visualizzazione: UI nascosta, zoom e pan sul media
  const [inspecting, setInspecting] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null); // le tre schermate (precedente, corrente, successiva)
  const sliding = useRef(false);
  const resumeVideo = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastWheel = useRef(0);
  const touchY = useRef<number | null>(null);
  const refreshing = useRef(false);

  const item = items[idx];
  const loaded = loadedId === item?.id;
  const failed = errorId === item?.id;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1400);
  }, []);

  // Cambia schermata: l'intera schermata (media e UI) scorre di una pagina, con
  // la successiva che entra da sotto; `d` è 1 per andare avanti, -1 indietro.
  // Senza `animate` (salti a inizio/fine) il cambio è immediato.
  const go = useCallback(
    (i: number, d: number, animate = true) => {
      if (!items.length || sliding.current) return;
      const target = (i + items.length) % items.length;
      const track = trackRef.current;
      const commit = () => {
        sliding.current = false;
        // il nuovo media deve essere montato prima che il binario torni a zero
        flushSync(() => {
          setIdx(target);
          setCardOpen(false);
          setInspecting(false);
        });
        if (track) {
          track.style.transition = "none";
          track.style.transform = "";
        }
      };
      if (!animate || !track || items.length < 2) return commit();
      sliding.current = true;
      track.style.transition = `transform ${SLIDE_MS}ms ease-out`;
      track.style.transform = `translateY(${-d * 100}%)`;
      setTimeout(commit, SLIDE_MS);
    },
    [items.length],
  );

  const next = useCallback(async () => {
    // in fondo a un thread ricarica la lista: potrebbero esserci nuovi post
    if (idx === items.length - 1 && onRefresh) {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const count = await onRefresh();
        go(idx + 1 < count ? idx + 1 : 0, 1);
      } catch {
        go(0, 1);
      } finally {
        refreshing.current = false;
      }
      return;
    }
    go(idx + 1, 1);
  }, [go, idx, items.length, onRefresh]);

  const prev = useCallback(() => go(idx - 1, -1), [go, idx]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      flash(m ? "Audio attivo" : "Audio disattivato");
      return !m;
    });
  }, [flash]);

  const togglePlaying = useCallback(() => {
    setPlaying((p) => {
      flash(p ? "Autoplay fermo" : "Autoplay attivo");
      return !p;
    });
  }, [flash]);

  // a fine video, con l'autoplay attivo, si passa al successivo
  const onVideoEnded = useCallback(() => {
    if (playing) next();
  }, [playing, next]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen().catch(() => {});
  }, []);

  const openPost = useCallback(() => {
    if (item) window.open(item.postUrl, "_blank", "noopener,noreferrer");
  }, [item]);

  // il file passa dal proxy, quindi è same-origin e l'attributo `download` funziona
  const download = useCallback(() => {
    if (!item) return;
    const a = document.createElement("a");
    a.href = item.src;
    a.download = item.name;
    a.click();
  }, [item]);

  const toggleInspect = useCallback(() => {
    if (!inspecting) flash("Doppio tap per uscire");
    setInspecting(!inspecting);
  }, [flash, inspecting]);

  const toggleVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  // in modalità visualizzazione il video si ferma; all'uscita riparte se andava
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inspecting) {
      // non ancora caricato: sarebbe partito da solo
      resumeVideo.current = !v.paused || v.readyState < 2;
      v.pause();
    } else if (resumeVideo.current) {
      resumeVideo.current = false;
      v.play().catch(() => {});
    }
  }, [inspecting]);

  // file non caricabile: salta al successivo se l'autoplay è attivo
  useEffect(() => {
    if (!failed || !playing || inspecting) return;
    const t = setTimeout(next, 1500);
    return () => clearTimeout(t);
  }, [failed, playing, inspecting, next]);

  useEffect(() => {
    onIndexChange?.(idx);
  }, [idx, onIndexChange]);

  // in download: il media in visione, o il suo originale in modalità visualizzazione
  const [fullBusy, setFullBusy] = useState(false);
  const busy = (!loaded && !failed) || fullBusy;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // blocca lo scroll della pagina sotto
  useEffect(() => {
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      clearTimeout(toastTimer.current);
    };
  }, []);

  // tastiera: sempre l'ultima versione delle azioni, senza ri-registrare il listener
  const keyActions = useRef<Record<string, () => void>>({});
  useEffect(() => {
    if (inspecting) {
      keyActions.current = { Escape: toggleInspect, d: download };
      return;
    }
    keyActions.current = {
      ArrowDown: next,
      ArrowRight: next,
      ArrowUp: prev,
      ArrowLeft: prev,
      " ": togglePlaying,
      Escape: onClose,
      Home: () => go(0, -1, false),
      End: () => go(items.length - 1, 1, false),
      m: toggleMute,
      f: toggleFullscreen,
      p: openPost,
      d: download,
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const fn = keyActions.current[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!fn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      fn();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    if (inspecting) return; // la rotella fa zoom
    if (cardOpen && (e.target as HTMLElement).closest("[data-scroll]")) return;
    const now = Date.now();
    if (now - lastWheel.current < WHEEL_THROTTLE || !e.deltaY) return;
    lastWheel.current = now;
    if (e.deltaY > 0) next();
    else prev();
  };

  // la schermata segue il dito; a fine gesto scorre alla successiva o torna a posto
  const dragStart = useRef<number | null>(null);
  const onTouchMove = (e: React.TouchEvent) => {
    const track = trackRef.current;
    if (!track || touchY.current == null || inspecting || sliding.current || e.touches.length > 1) return;
    if (cardOpen && (e.target as HTMLElement).closest("[data-scroll]")) return;
    const dy = e.touches[0].clientY - touchY.current;
    if (dragStart.current == null && Math.abs(dy) < TAP_SLOP) return;
    dragStart.current = touchY.current;
    track.style.transition = "none";
    track.style.transform = `translateY(${dy}px)`;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchY.current;
    touchY.current = null;
    if (start == null || dragStart.current == null) return;
    dragStart.current = null;
    const dy = e.changedTouches[0].clientY - start;
    if (Math.abs(dy) > SWIPE_THRESHOLD && !inspecting) {
      if (dy < 0) next();
      else prev();
    }
    // nessuno scorrimento in corso (soglia non raggiunta, o ultima pagina in attesa di ricarica): torna a posto
    if (!sliding.current && trackRef.current) {
      trackRef.current.style.transition = `transform ${SLIDE_MS}ms ease-out`;
      trackRef.current.style.transform = "";
    }
  };

  if (!item) return null;

  // Una schermata completa: media (o anteprima, per le adiacenti) e UI. Le
  // adiacenti sono inerti e servono solo a farle scorrere insieme alla corrente.
  const slide = (o: -1 | 0 | 1) => {
    const it = items[(idx + o + items.length) % items.length];
    const live = o === 0;
    return (
      <div key={o} className="absolute inset-0" style={{ transform: `translateY(${o * 100}%)` }} inert={!live}>
        <div key={it.id} className="absolute inset-0">
          {!live ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={o === 1 && loaded && !it.video ? it.preview : it.thumb}
              alt=""
              draggable={false}
              className="absolute inset-0 size-full object-contain"
            />
          ) : failed ? (
            <div className="grid h-full place-items-center text-red-300">Impossibile caricare il file</div>
          ) : (
            <Stage inspecting={inspecting} onTap={it.video ? toggleVideo : undefined} onDoubleTap={toggleInspect}>
              {it.video ? (
                <VideoSlide
                  item={it}
                  videoRef={videoRef}
                  muted={muted}
                  playing={playing}
                  frozen={inspecting}
                  barRef={barRef}
                  onEnded={onVideoEnded}
                  onError={() => setErrorId(it.id)}
                  onLoaded={() => setLoadedId(it.id)}
                  onMutedFallback={() => setMuted(true)}
                />
              ) : (
                <ImageSlide
                  item={it}
                  full={inspecting}
                  onLoad={() => setLoadedId(it.id)}
                  onError={() => setErrorId(it.id)}
                  onFullBusy={setFullBusy}
                />
              )}
            </Stage>
          )}
        </div>

        {/* in modalità visualizzazione la UI è solo nascosta, non smontata */}
        <div className={inspecting ? "hidden" : "contents"}>
          {/* barra di progresso dei video, legata al tempo di riproduzione */}
          <div className="absolute inset-x-0 top-0 z-20 h-[3px] bg-white/15">
            {it.video && <div ref={live ? barRef : undefined} className="h-full w-0 bg-white" />}
          </div>

          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-white/30 px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-white/20"
            >
              <ArrowLeftIcon width={14} height={14} className="drop-shadow" /> Torna al random
            </button>
          )}

          {badge && <div className="absolute right-4 top-4 z-20">{badge}</div>}

          <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-3">
            <RoundButton onClick={togglePlaying} label={playing ? "Ferma autoplay (Spazio)" : "Avvia autoplay (Spazio)"}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </RoundButton>
            <RoundButton onClick={toggleMute} label={muted ? "Attiva audio (M)" : "Disattiva audio (M)"}>
              {muted ? <VolumeOffIcon /> : <VolumeIcon />}
            </RoundButton>
            <RoundButton onClick={toggleFullscreen} label={fullscreen ? "Esci da schermo intero (F)" : "Schermo intero (F)"}>
              <ExpandIcon />
            </RoundButton>
            <RoundButton onClick={download} label="Scarica (D)">
              <DownloadIcon />
            </RoundButton>
            <RoundButton href={it.postUrl} label="Vai al post su 4chan (P)">
              <ExternalIcon />
            </RoundButton>
            <RoundButton onClick={onClose} label="Chiudi (Esc)">
              <CloseIcon />
            </RoundButton>
          </div>

          <ThreadCard
            item={it}
            open={live && cardOpen}
            onToggle={() => setCardOpen((o) => !o)}
            onOpenThread={live && onOpenThread ? () => onOpenThread(it, idx) : undefined}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 select-none overflow-hidden overscroll-none bg-black text-white [touch-action:none]"
      onWheel={onWheel}
      onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div ref={trackRef} className="absolute inset-0 will-change-transform">
        {items.length > 1 && slide(-1)}
        {slide(0)}
        {items.length > 1 && slide(1)}
      </div>

      {/* senza UI non c'è altro modo di capire che l'originale sta arrivando */}
      {inspecting && busy && (
        <div
          className="pointer-events-none absolute bottom-6 right-4 z-30 grid size-11 place-items-center rounded-full bg-black/50 backdrop-blur"
          aria-label="Caricamento"
        >
          <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  );
}

// Bottone tondo "ghost": trasparente, con bordo sottile; è un link se ha href.
function RoundButton({
  onClick,
  href,
  label,
  children,
}: {
  onClick?: () => void;
  href?: string;
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    "grid size-11 place-items-center rounded-full border border-white/30 transition-colors hover:bg-white/20 [&>svg]:drop-shadow";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={label} aria-label={label} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cls}>
      {children}
    </button>
  );
}

// Come per il video, `src` è impostato nell'effetto: così il cleanup può
// interrompere il download quando l'immagine non serve più prima della fine.
function useAbortableSrc(src: string | null) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (!img || !src) return;
    img.src = src;
    return () => {
      if (!img.complete) img.removeAttribute("src");
    };
  }, [src]);
  return ref;
}

type ImageProps = {
  item: Media;
  full: boolean; // modalità visualizzazione: serve l'originale
  onLoad: () => void;
  onError: () => void;
  onFullBusy: (busy: boolean) => void;
};

// Mostra la preview; l'originale si scarica solo in modalità visualizzazione e
// compare sopra la preview quando è pronto. Se si esce prima, il download si
// interrompe; se è già arrivato resta.
function ImageSlide({ item, full, onLoad, onError, onFullBusy }: ImageProps) {
  const [fullLoaded, setFullLoaded] = useState(false);
  const needFull = item.preview !== item.src && (full || fullLoaded);
  const previewRef = useAbortableSrc(item.preview);
  const fullRef = useAbortableSrc(needFull ? item.src : null);

  useEffect(() => {
    onFullBusy(needFull && !fullLoaded);
    return () => onFullBusy(false);
  }, [needFull, fullLoaded, onFullBusy]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={previewRef}
        alt={item.name}
        draggable={false}
        fetchPriority="high"
        className={`absolute inset-0 size-full object-contain ${fullLoaded ? "invisible" : ""}`}
        onLoad={onLoad}
        onError={onError}
      />
      {needFull && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={fullRef}
          alt=""
          draggable={false}
          fetchPriority="high"
          className={`absolute inset-0 size-full object-contain ${fullLoaded ? "" : "opacity-0"}`}
          onLoad={() => setFullLoaded(true)}
        />
      )}
    </>
  );
}

type VideoProps = {
  item: Media;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted: boolean;
  playing: boolean;
  frozen: boolean; // modalità visualizzazione: non deve partire da solo
  barRef: React.RefObject<HTMLDivElement | null>;
  onEnded: () => void;
  onError: () => void;
  onLoaded: () => void; // abbastanza dati per partire: il resto arriva a blocchi dal proxy
  onMutedFallback: () => void;
};

// Nessun controllo nativo: un tap (gestito dallo Stage) mette in pausa o riprende.
function VideoSlide({
  item,
  videoRef: ref,
  muted,
  playing,
  frozen,
  barRef,
  onEnded,
  onError,
  onLoaded,
  onMutedFallback,
}: VideoProps) {
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // src impostato qui (non come prop) così lo StrictMode, che rilancia l'effetto
    // dopo il cleanup, lo ripristina. Il cleanup libera le risorse: il file non
    // resta in download quando si cambia media.
    v.src = item.src;
    return () => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    };
  }, [ref, item.src]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [ref, muted]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.loop = !playing;
    if (playing && v.paused && v.readyState > 0) v.play().catch(() => {});
  }, [ref, playing]);

  const start = () => {
    const v = ref.current;
    if (!v) return;
    if (frozen) return;
    // l'audio attivo può essere bloccato dal browser: in quel caso riparte muto
    v.play().catch(() => {
      v.muted = true;
      onMutedFallback();
      v.play().catch(() => {});
    });
  };

  return (
    <video
      ref={ref}
      poster={item.thumb}
      className={`absolute inset-0 size-full object-contain ${frozen ? "" : "cursor-pointer"}`}
      playsInline
      disablePictureInPicture
      loop={!playing}
      onLoadedData={start}
      onEnded={onEnded}
      onError={onError}
      onCanPlay={onLoaded}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (barRef.current && v.duration) barRef.current.style.width = `${(v.currentTime / v.duration) * 100}%`;
      }}
    />
  );
}
