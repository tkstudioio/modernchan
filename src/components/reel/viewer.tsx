"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const STORE = "modernchan:";
const MIN_INTERVAL = 1;
const MAX_INTERVAL = 60;
const WHEEL_THROTTLE = 450;
const SWIPE_THRESHOLD = 50;

function loadInterval() {
  try {
    const v = Number(localStorage.getItem(STORE + "interval"));
    return v >= MIN_INTERVAL && v <= MAX_INTERVAL ? v : 5;
  } catch {
    return 5;
  }
}

function saveInterval(v: number) {
  try {
    localStorage.setItem(STORE + "interval", String(v));
  } catch {}
}

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
  const [dir, setDir] = useState(0); // 1 = si arriva dal basso, -1 = dall'alto
  const [playing, setPlaying] = useState(true); // autoplay di default
  const [muted, setMuted] = useState(false); // audio attivo di default (solo per la sessione)
  const [interval, setIntervalSec] = useState(loadInterval);
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

  const go = useCallback(
    (i: number, d: number) => {
      if (!items.length) return;
      setIdx((i + items.length) % items.length);
      setDir(d);
      setCardOpen(false);
      setInspecting(false);
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

  const changeInterval = useCallback(
    (delta: number) => {
      const v = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, interval + delta));
      setIntervalSec(v);
      saveInterval(v);
      flash(`${v} s per immagine`);
    },
    [flash, interval],
  );

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

  // autoplay delle immagini: avanza dopo `interval` secondi dal caricamento
  const isImage = item && !item.video;
  useEffect(() => {
    if (!isImage || !loaded || !playing || inspecting) return;
    const t = setTimeout(next, interval * 1000);
    return () => clearTimeout(t);
  }, [isImage, loaded, playing, inspecting, interval, next]);

  // file non caricabile: salta al successivo se l'autoplay è attivo
  useEffect(() => {
    if (!failed || !playing || inspecting) return;
    const t = setTimeout(next, 1500);
    return () => clearTimeout(t);
  }, [failed, playing, inspecting, next]);

  useEffect(() => {
    onIndexChange?.(idx);
  }, [idx, onIndexChange]);

  useEffect(() => {
    onBusyChange?.(!loaded && !failed);
  }, [loaded, failed, onBusyChange]);

  // precarica l'immagine successiva
  useEffect(() => {
    const n = items[(idx + 1) % items.length];
    if (n && !n.video) new Image().src = n.src;
  }, [idx, items]);

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
      Home: () => go(0, -1),
      End: () => go(items.length - 1, 1),
      "+": () => changeInterval(1),
      "=": () => changeInterval(1),
      "-": () => changeInterval(-1),
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

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    if (!inspecting && Math.abs(dy) > SWIPE_THRESHOLD) {
      if (dy < 0) next();
      else prev();
    }
  };

  if (!item) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 select-none overflow-hidden overscroll-none bg-black text-white [touch-action:none]"
      onWheel={onWheel}
      onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
      onTouchEnd={onTouchEnd}
    >
      <div key={item.id} className={`absolute inset-0 ${dir > 0 ? "animate-slide-up" : dir < 0 ? "animate-slide-down" : ""}`}>
        {failed ? (
          <div className="grid h-full place-items-center text-red-300">Impossibile caricare il file</div>
        ) : (
          <Stage inspecting={inspecting} onTap={item.video ? toggleVideo : undefined} onDoubleTap={toggleInspect}>
            {item.video ? (
              <VideoSlide
                item={item}
                videoRef={videoRef}
                muted={muted}
                playing={playing}
                frozen={inspecting}
                barRef={barRef}
                onEnded={() => playing && next()}
                onError={() => setErrorId(item.id)}
                onLoaded={() => setLoadedId(item.id)}
                onMutedFallback={() => setMuted(true)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.src}
                alt={item.name}
                draggable={false}
                fetchPriority="high"
                className="absolute inset-0 size-full object-contain"
                onLoad={() => setLoadedId(item.id)}
                onError={() => setErrorId(item.id)}
              />
            )}
          </Stage>
        )}
      </div>

      {/* in modalità visualizzazione la UI è solo nascosta, non smontata */}
      <div className={inspecting ? "hidden" : "contents"}>
        {/* barra di progresso: animata per le immagini, legata al tempo di riproduzione per i video */}
        <div className="absolute inset-x-0 top-0 z-20 h-[3px] bg-white/15">
          {isImage ? (
            <div
              key={`${item.id}-${interval}-${playing}-${loaded}-${inspecting}`}
              className="h-full bg-white"
              style={
                playing && loaded
                  ? { animation: `progress ${interval}s linear forwards` }
                  : { width: 0 }
              }
            />
          ) : (
            <div ref={barRef} className="h-full w-0 bg-white" />
          )}
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
          <RoundButton href={item.postUrl} label="Vai al post su 4chan (P)">
            <ExternalIcon />
          </RoundButton>
          <RoundButton onClick={onClose} label="Chiudi (Esc)">
            <CloseIcon />
          </RoundButton>
        </div>

        <ThreadCard
          item={item}
          open={cardOpen}
          onToggle={() => setCardOpen((o) => !o)}
          onOpenThread={onOpenThread && (() => onOpenThread(item, idx))}
        />
      </div>

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

type VideoProps = {
  item: Media;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted: boolean;
  playing: boolean;
  frozen: boolean; // modalità visualizzazione: non deve partire da solo
  barRef: React.RefObject<HTMLDivElement | null>;
  onEnded: () => void;
  onError: () => void;
  onLoaded: () => void; // file scaricato, o il browser ha smesso di scaricarlo
  onMutedFallback: () => void;
};

// tutto il file è nel buffer
function fullyBuffered(v: HTMLVideoElement) {
  const b = v.buffered;
  return v.duration > 0 && b.length === 1 && b.start(0) <= 0.1 && b.end(0) >= v.duration - 0.1;
}

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
    if (fullyBuffered(v)) onLoaded(); // già in cache
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
      onProgress={(e) => fullyBuffered(e.currentTarget) && onLoaded()}
      // in pausa il browser può fermare il download: la banda torna libera
      onSuspend={(e) => {
        const v = e.currentTarget;
        if (fullyBuffered(v) || (v.paused && v.readyState >= 2)) onLoaded();
      }}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (barRef.current && v.duration) barRef.current.style.width = `${(v.currentTime / v.duration) * 100}%`;
      }}
    />
  );
}
