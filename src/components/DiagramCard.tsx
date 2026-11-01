import React from "react";
import { Easing, interpolate, interpolateColors } from "remotion";
import { toFrames } from "../lib/timeline";
import { theme } from "../theme";
import timingConfig from "../timing.json";
import type { DiagramArrow, DiagramBox, DiagramStep, DiagramTone } from "../types";

export type TimedDiagramStep = DiagramStep & {
  /** Scene-relative frame where the step's narration line starts. */
  startFrame: number;
};

const W = timingConfig.diagram.width;
const H = timingConfig.diagram.height;
const FADE = toFrames(timingConfig.diagram.fadeSec);
const FLOW_LOOP = toFrames(timingConfig.diagram.flowLoopSec);

const TONE: Record<DiagramTone, { edge: string; fill: string; text: string }> = {
  neutral: { edge: "#3d4c82", fill: "rgba(61, 76, 130, 0.18)", text: theme.textDim },
  accent: { edge: theme.accent, fill: "rgba(79, 134, 247, 0.16)", text: theme.accent },
  good: { edge: theme.prompt, fill: "rgba(95, 211, 141, 0.14)", text: theme.prompt },
  bad: { edge: "#ff7a7a", fill: "rgba(255, 122, 122, 0.16)", text: "#ff7a7a" },
  warn: { edge: theme.highlightEdge, fill: "rgba(255, 196, 77, 0.14)", text: theme.highlightEdge },
};

type Change<T> = { frame: number; value: T };

/** The value before and after the latest change at or before `frame`, and how far that change has eased in (0 to 1). */
const track = <T,>(initial: T, changes: Change<T>[], frame: number) => {
  let prev = initial;
  let cur = initial;
  let since = -Infinity;
  for (const c of changes) {
    if (c.frame > frame) break;
    prev = cur;
    cur = c.value;
    since = c.frame;
  }
  const p =
    since === -Infinity
      ? 1
      : interpolate(frame, [since, since + FADE], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        });
  return { prev, cur, p, since };
};

const mix = (a: number, b: number, p: number) => a + (b - a) * p;

type ElementState = { opacity: number; edge: string; fill: string; text: string; dim: number; focus: number };

/** Works out each box's and arrow's look at `frame` from the steps that have started. */
const elementState = (
  id: string,
  hidden: boolean | undefined,
  tone: DiagramTone,
  steps: TimedDiagramStep[],
  frame: number,
): ElementState => {
  const visibility: Change<boolean>[] = [];
  const tones: Change<DiagramTone>[] = [];
  const focus: Change<"none" | "in" | "out">[] = [];
  for (const s of steps) {
    if (s.show?.includes(id)) visibility.push({ frame: s.startFrame, value: true });
    if (s.hide?.includes(id)) visibility.push({ frame: s.startFrame, value: false });
    const t = s.tone?.[id];
    if (t) tones.push({ frame: s.startFrame, value: t });
    if (s.focus) focus.push({ frame: s.startFrame, value: s.focus.length === 0 ? "none" : s.focus.includes(id) ? "in" : "out" });
  }
  const v = track(!hidden, visibility, frame);
  const t = track(tone, tones, frame);
  const f = track<"none" | "in" | "out">("none", focus, frame);
  const dimOf = (x: "none" | "in" | "out") => (x === "out" ? 1 : 0);
  const focusOf = (x: "none" | "in" | "out") => (x === "in" ? 1 : 0);
  return {
    opacity: mix(v.prev ? 1 : 0, v.cur ? 1 : 0, v.p),
    edge: interpolateColors(t.p, [0, 1], [TONE[t.prev].edge, TONE[t.cur].edge]),
    fill: interpolateColors(t.p, [0, 1], [TONE[t.prev].fill, TONE[t.cur].fill]),
    text: interpolateColors(t.p, [0, 1], [TONE[t.prev].text, TONE[t.cur].text]),
    dim: mix(dimOf(f.prev), dimOf(f.cur), f.p),
    focus: mix(focusOf(f.prev), focusOf(f.cur), f.p),
  };
};

type Point = { x: number; y: number };

/** Where a ray from the box's center towards `toward` leaves the box, plus a small gap. */
const exitPoint = (b: DiagramBox, toward: Point, gap = 10): Point => {
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const sx = dx === 0 ? Infinity : b.w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : b.h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  const len = Math.hypot(dx, dy);
  return { x: c.x + dx * s + (dx / len) * gap, y: c.y + dy * s + (dy / len) * gap };
};

const arrowGeometry = (a: DiagramArrow, boxes: Map<string, DiagramBox>) => {
  const from = boxes.get(a.from)!;
  const to = boxes.get(a.to)!;
  const c1 = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const c2 = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const len = Math.hypot(c2.x - c1.x, c2.y - c1.y) || 1;
  const normal = { x: -(c2.y - c1.y) / len, y: (c2.x - c1.x) / len };
  const bend = a.curve ?? 0;
  const control = { x: (c1.x + c2.x) / 2 + normal.x * bend, y: (c1.y + c2.y) / 2 + normal.y * bend };
  const start = exitPoint(from, control);
  const end = exitPoint(to, control, 14);
  const at = (t: number): Point => ({
    x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
    y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
  });
  let length = 0;
  let last = start;
  for (let i = 1; i <= 24; i++) {
    const p = at(i / 24);
    length += Math.hypot(p.x - last.x, p.y - last.y);
    last = p;
  }
  // Arrowhead along the curve's direction at its end.
  const dir = { x: end.x - control.x, y: end.y - control.y };
  const dl = Math.hypot(dir.x, dir.y) || 1;
  const u = { x: dir.x / dl, y: dir.y / dl };
  const head = [
    { x: end.x + u.x * 12, y: end.y + u.y * 12 },
    { x: end.x - u.y * 9, y: end.y + u.x * 9 },
    { x: end.x + u.y * 9, y: end.y - u.x * 9 },
  ];
  return { d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, at, length, head };
};

/**
 * A diagram of boxes and arrows laid out in the script. Each step, tied to a
 * narration line, can show, hide, recolor or focus parts of it.
 */
export const DiagramCard: React.FC<{
  frame: number;
  title?: string;
  boxes: DiagramBox[];
  arrows: DiagramArrow[];
  steps: TimedDiagramStep[];
}> = ({ frame, title, boxes, arrows, steps }) => {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const flows: Change<string[]>[] = steps.filter((s) => s.flow).map((s) => ({ frame: s.startFrame, value: s.flow! }));
  const flow = track<string[]>([], flows, frame);
  const groups = boxes.filter((b) => b.kind === "group");
  const others = boxes.filter((b) => b.kind !== "group");

  return (
    <div style={{ position: "relative", width: W, height: H, fontFamily: theme.font.sans }}>
      {title ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            color: theme.textDim,
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      ) : null}
      {groups.map((b) => (
        <Box key={b.id} box={b} state={elementState(b.id, b.hidden, b.tone ?? "neutral", steps, frame)} />
      ))}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {arrows.map((a) => {
          const s = elementState(a.id, a.hidden, a.tone ?? "neutral", steps, frame);
          if (s.opacity <= 0.001) return null;
          const g = arrowGeometry(a, byId);
          // Arrows draw themselves in as they appear.
          const shown = s.opacity;
          const opacity = (1 - 0.7 * s.dim) * Math.min(1, shown * 1.5);
          const mid = g.at(0.5);
          const flowing = flow.cur.includes(a.id) && shown > 0.99;
          const dotT = flowing ? ((frame - flow.since) % FLOW_LOOP) / FLOW_LOOP : 0;
          const dot = g.at(dotT);
          return (
            <g key={a.id} opacity={opacity}>
              <path
                d={g.d}
                fill="none"
                stroke={s.edge}
                strokeWidth={3 + s.focus * 1.5}
                strokeLinecap="round"
                strokeDasharray={g.length}
                strokeDashoffset={g.length * (1 - shown)}
              />
              <polygon points={g.head.map((p) => `${p.x},${p.y}`).join(" ")} fill={s.edge} opacity={shown > 0.85 ? 1 : 0} />
              {flowing ? <circle cx={dot.x} cy={dot.y} r={8} fill={theme.highlightEdge} /> : null}
              {a.label ? (
                <text
                  x={mid.x}
                  y={mid.y - 14}
                  textAnchor="middle"
                  fill={theme.textDim}
                  fontFamily={theme.font.sans}
                  fontSize={24}
                  fontWeight={500}
                  style={{ paintOrder: "stroke", stroke: theme.bg, strokeWidth: 8 }}
                >
                  {a.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {others.map((b) => (
        <Box key={b.id} box={b} state={elementState(b.id, b.hidden, b.tone ?? "neutral", steps, frame)} />
      ))}
    </div>
  );
};

const Box: React.FC<{ box: DiagramBox; state: ElementState }> = ({ box, state }) => {
  if (state.opacity <= 0.001) return null;
  const kind = box.kind ?? "component";
  const scale = mix(0.92, 1, state.opacity);
  const opacity = state.opacity * (1 - 0.7 * state.dim);
  const base: React.CSSProperties = {
    position: "absolute",
    left: box.x,
    top: box.y,
    width: box.w,
    height: box.h,
    opacity,
    transform: `scale(${scale})`,
    boxSizing: "border-box",
  };
  const ring = state.focus > 0 ? `0 0 0 ${4 * state.focus}px ${theme.highlightEdge}` : undefined;

  if (kind === "group") {
    return (
      <div
        style={{
          ...base,
          border: `3px dashed ${state.edge}`,
          borderRadius: 26,
          background: "rgba(255, 255, 255, 0.02)",
          boxShadow: ring,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 16,
            color: state.edge,
            fontWeight: 600,
            fontSize: 24,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          {box.label}
        </div>
        {box.sublabel ? (
          <div style={{ position: "absolute", right: 24, top: 18, color: theme.textDim, fontFamily: theme.font.mono, fontSize: 20 }}>
            {box.sublabel}
          </div>
        ) : null}
      </div>
    );
  }

  if (kind === "note") {
    return (
      <div
        style={{
          ...base,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: state.text,
          fontSize: 28,
          fontWeight: 500,
        }}
      >
        <div>{box.label}</div>
        {box.sublabel ? <div style={{ fontFamily: theme.font.mono, fontSize: 22, marginTop: 6 }}>{box.sublabel}</div> : null}
      </div>
    );
  }

  const pod = kind === "pod";
  return (
    <div
      style={{
        ...base,
        background: `linear-gradient(${state.fill}, ${state.fill}), ${theme.card}`,
        border: `3px solid ${state.edge}`,
        borderRadius: pod ? box.h / 2 : 18,
        boxShadow: [ring, "0 18px 50px rgba(0, 0, 0, 0.45)"].filter(Boolean).join(", "),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 14px",
      }}
    >
      <div style={{ color: theme.text, fontWeight: 600, fontSize: pod ? 24 : 30, lineHeight: 1.2 }}>{box.label}</div>
      {box.sublabel ? (
        <div style={{ color: theme.textDim, fontFamily: theme.font.mono, fontSize: pod ? 18 : 21, marginTop: 6 }}>
          {box.sublabel}
        </div>
      ) : null}
    </div>
  );
};
