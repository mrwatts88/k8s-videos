import React from "react";
import { interpolate } from "remotion";
import type { LineTiming } from "../types";
import { theme } from "../theme";

const MAX_CHUNK_CHARS = 72;
const FADE = 4;

/** Splits a line into caption chunks of at most MAX_CHUNK_CHARS, at word breaks. */
export const chunkCaption = (text: string): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const total = text.length;
  const parts = Math.max(1, Math.ceil(total / MAX_CHUNK_CHARS));
  const target = total / parts;
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > target && chunks.length < parts - 1) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

/**
 * Shows the caption for whichever narration line is playing. Long lines are
 * split into chunks timed by their share of the line's characters.
 */
export const Captions: React.FC<{ frame: number; lines: LineTiming[] }> = ({ frame, lines }) => {
  const line = lines.find((l) => frame >= l.from && frame < l.from + l.durationInFrames);
  if (!line) return null;

  const chunks = chunkCaption(line.text);
  const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
  let start = line.from;
  let shown = chunks[chunks.length - 1];
  let chunkStart = start;
  let chunkEnd = line.from + line.durationInFrames;
  for (const chunk of chunks) {
    const length = Math.round((chunk.length / totalChars) * line.durationInFrames);
    if (frame < start + length || chunk === chunks[chunks.length - 1]) {
      shown = chunk;
      chunkStart = start;
      chunkEnd = chunk === chunks[chunks.length - 1] ? line.from + line.durationInFrames : start + length;
      break;
    }
    start += length;
  }

  const opacity = interpolate(frame, [chunkStart, chunkStart + FADE, chunkEnd - FADE, chunkEnd], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 46,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          padding: "14px 30px",
          borderRadius: 14,
          background: "rgba(5, 8, 18, 0.82)",
          color: theme.text,
          fontFamily: theme.font.sans,
          fontWeight: 500,
          fontSize: 38,
          lineHeight: 1.3,
          textAlign: "center",
          opacity,
        }}
      >
        {shown}
      </div>
    </div>
  );
};
