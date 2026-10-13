"use client";

import { useEffect, useRef } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const TAP_MOVE = 10; // px oltre i quali non è più un tap
const TAP_TIME = 300; // ms massimi di pressione per un tap
const DOUBLE_TAP = 300; // ms massimi fra i due tap
const DOUBLE_TAP_DIST = 40; // px massimi fra i due tap

type Pt = { x: number; y: number };
type View = { s: number; x: number; y: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

type Props = {
  inspecting: boolean;
  onTap?: () => void;
  onDoubleTap: () => void;
  children: React.ReactNode;
};

// Area del media: riconosce tap e doppio tap (anche col mouse). In modalità
// visualizzazione gestisce lo zoom (pinch, rotella) e il pan (trascinamento).
export function Stage({ inspecting, onTap, onDoubleTap, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, Pt>());
  // stato di partenza del gesto in corso: vista, punto medio, distanza fra le dita
  const gesture = useRef<{ view: View; mid: Pt; dist: number } | null>(null);
  const press = useRef<{ p: Pt; t: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ p: Pt; t: number } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // posizione relativa al centro dell'area, come l'origine della trasformazione
  const rel = (e: { clientX: number; clientY: number }): Pt => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  const apply = (v: View, animate = false) => {
    const el = rootRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    // il media non può uscire dai bordi più di quanto lo zoom lo abbia ingrandito
    const mx = (el.clientWidth * (v.s - 1)) / 2;
    const my = (el.clientHeight * (v.s - 1)) / 2;
    const next = { s: v.s, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) };
    view.current = next;
    inner.style.transition = animate ? "transform 200ms ease-out" : "";
    inner.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.s})`;
  };

  // porta lo zoom a `s` mantenendo fermo il punto `p`
  const zoomAt = (from: View, p: Pt, s: number): View => {
    const k = clamp(s, MIN_SCALE, MAX_SCALE) / from.s;
    return { s: from.s * k, x: p.x - (p.x - from.x) * k, y: p.y - (p.y - from.y) * k };
  };

  // nuovo punto di partenza ogni volta che cambia il numero di dita
  const resetGesture = () => {
    const pts = [...pointers.current.values()];
    if (!pts.length) {
      gesture.current = null;
      return;
    }
    const [a, b = a] = pts;
    gesture.current = {
      view: { ...view.current },
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dist: dist(a, b),
    };
  };

  const tap = (p: Pt) => {
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < DOUBLE_TAP && dist(p, prev.p) < DOUBLE_TAP_DIST) {
      lastTap.current = null;
      clearTimeout(tapTimer.current);
      onDoubleTap();
      return;
    }
    lastTap.current = { p, t: now };
    // il tap singolo aspetta: potrebbe essere l'inizio di un doppio tap
    if (onTap && !inspecting) {
      clearTimeout(tapTimer.current);
      tapTimer.current = setTimeout(onTap, DOUBLE_TAP);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = rel(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) press.current = { p, t: Date.now(), moved: false };
    else if (press.current) press.current.moved = true; // più dita: non è un tap
    resetGesture();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = rel(e);
    pointers.current.set(e.pointerId, p);
    if (press.current && dist(p, press.current.p) > TAP_MOVE) press.current.moved = true;

    const g = gesture.current;
    if (!inspecting || !g) return;
    const [a, b] = [...pointers.current.values()];
    if (b) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = zoomAt(g.view, g.mid, (g.view.s * dist(a, b)) / g.dist);
      // il punto medio trascina anche la vista: pinch e pan insieme
      apply({ s: z.s, x: z.x + mid.x - g.mid.x, y: z.y + mid.y - g.mid.y });
    } else {
      apply({ s: g.view.s, x: g.view.x + a.x - g.mid.x, y: g.view.y + a.y - g.mid.y });
    }
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (!pointers.current.size) {
      const pr = press.current;
      press.current = null;
      if (e.type === "pointerup" && pr && !pr.moved && Date.now() - pr.t < TAP_TIME) tap(rel(e));
    }
    resetGesture();
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!inspecting || !e.deltaY) return;
    const v = view.current;
    apply(zoomAt(v, rel(e), v.s * Math.exp(-e.deltaY * 0.002)));
  };

  // all'uscita dalla modalità visualizzazione la vista torna com'era
  useEffect(() => {
    if (!inspecting) apply({ s: 1, x: 0, y: 0 }, true);
  }, [inspecting]);

  useEffect(() => () => clearTimeout(tapTimer.current), []);

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 ${inspecting ? "cursor-grab active:cursor-grabbing" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onWheel={onWheel}
    >
      <div ref={innerRef} className="absolute inset-0 origin-center will-change-transform">
        {children}
      </div>
    </div>
  );
}
