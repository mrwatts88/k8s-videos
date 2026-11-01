import React from "react";
import { Easing, interpolate } from "remotion";
import { highlightYamlLine } from "../lib/yaml";
import { theme } from "../theme";
import { Card } from "./Card";

export type TimedHighlight = {
  /** Scene-relative frame where this highlight becomes active. */
  startFrame: number;
  lines: [number, number];
};

const LINE_HEIGHT = 40;
const VIEW_ROWS = 16;
const MOVE_FRAMES = 14;

/**
 * Shows a file with line numbers and syntax colors, and moves a highlight band
 * through it in step with narration. Long files scroll so the band stays in view.
 */
export const CodeCard: React.FC<{
  frame: number;
  file: string;
  source: string;
  range?: [number, number];
  highlights: TimedHighlight[];
}> = ({ frame, file, source, range, highlights }) => {
  const all = source.replace(/\n$/, "").split("\n");
  const [first, last] = range ?? [1, all.length];
  const lines = all.slice(first - 1, last);

  // The active highlight and the one before it, for the move animation.
  let current = -1;
  highlights.forEach((h, i) => {
    if (frame >= h.startFrame) current = i;
  });
  const active = current >= 0 ? highlights[current] : null;
  const previous = current > 0 ? highlights[current - 1] : null;
  const moveProgress = active
    ? interpolate(frame, [active.startFrame, active.startFrame + MOVE_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      })
    : 0;

  const band = (h: TimedHighlight | null) =>
    h ? { top: (h.lines[0] - first) * LINE_HEIGHT, height: (h.lines[1] - h.lines[0] + 1) * LINE_HEIGHT } : null;
  const to = band(active);
  const from = band(previous) ?? (to ? { ...to, height: 0 } : null);
  const bandTop = to && from ? from.top + (to.top - from.top) * moveProgress : 0;
  const bandHeight = to && from ? from.height + (to.height - from.height) * moveProgress : 0;
  const bandOpacity = active ? (previous ? 1 : moveProgress) : 0;

  // Keep the band roughly centered when the file is longer than the view.
  const maxScroll = Math.max(0, lines.length - VIEW_ROWS) * LINE_HEIGHT;
  const scrollFor = (b: { top: number; height: number } | null) => {
    // No scroll while the band already sits inside the first screen with a line to spare.
    if (!b || b.top + b.height <= (VIEW_ROWS - 1) * LINE_HEIGHT) return 0;
    return Math.min(maxScroll, Math.max(0, b.top + b.height / 2 - (VIEW_ROWS * LINE_HEIGHT) / 2));
  };
  const scroll = scrollFor(from) + (scrollFor(to) - scrollFor(from)) * moveProgress;

  const inBand = (n: number) => active && n >= active.lines[0] && n <= active.lines[1];

  return (
    <Card label={file} badge="yaml">
      <div style={{ position: "absolute", inset: "24px 0 0 0", overflow: "hidden" }}>
        <div style={{ transform: `translateY(${-scroll}px)`, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: bandTop,
              height: bandHeight,
              background: theme.highlight,
              borderLeft: `6px solid ${theme.highlightEdge}`,
              opacity: bandOpacity,
            }}
          />
          {lines.map((line, i) => {
            const n = first + i;
            const dim = active && moveProgress === 1 && !inBand(n);
            return (
              <div
                key={n}
                style={{
                  display: "flex",
                  height: LINE_HEIGHT,
                  alignItems: "center",
                  fontFamily: theme.font.mono,
                  fontSize: 28,
                  whiteSpace: "pre",
                  position: "relative",
                  opacity: dim ? 0.55 : 1,
                }}
              >
                <span style={{ width: 90, textAlign: "right", paddingRight: 28, color: theme.textDim, opacity: 0.6 }}>
                  {n}
                </span>
                <span>
                  {highlightYamlLine(line).map((t, j) => (
                    <span key={j} style={{ color: t.color }}>
                      {t.text}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
