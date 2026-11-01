import React from "react";
import { interpolate } from "remotion";
import { theme } from "../theme";
import { Card } from "./Card";

export type TimedStep = {
  /** Scene-relative frame where typing starts. */
  startFrame: number;
  command: string;
  output: string[];
};

const TYPE_DELAY = 6; // frames after the narration line starts
const CHARS_PER_FRAME = 1.6;
const MAX_TYPE_FRAMES = 42;
const OUTPUT_DELAY = 8; // frames between the last typed character and the output
const OUTPUT_STAGGER = 2;
const MAX_VISIBLE_ROWS = 17;

export const typingFrames = (command: string) =>
  Math.min(MAX_TYPE_FRAMES, Math.ceil(command.length / CHARS_PER_FRAME));

type Row = { kind: "command" | "output"; text: string; key: string; typing?: boolean };

/**
 * A terminal that types each command when its narration line begins, then
 * prints the output. Old rows scroll off the top like a real terminal.
 */
export const TerminalCard: React.FC<{
  frame: number;
  title: string;
  prompt: string;
  steps: TimedStep[];
}> = ({ frame, title, prompt, steps }) => {
  const rows: Row[] = [];
  let cursorVisibleOnPrompt = true;

  steps.forEach((step, s) => {
    const typeStart = step.startFrame + TYPE_DELAY;
    if (frame < typeStart) return;
    const total = typingFrames(step.command);
    const progress = interpolate(frame, [typeStart, typeStart + total], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const typed = step.command.slice(0, Math.round(progress * step.command.length));
    const typing = progress < 1;
    rows.push({ kind: "command", text: typed, key: `c${s}`, typing });
    if (typing) {
      cursorVisibleOnPrompt = false;
      return;
    }
    const outStart = typeStart + total + OUTPUT_DELAY;
    step.output.forEach((line, i) => {
      if (frame >= outStart + i * OUTPUT_STAGGER) rows.push({ kind: "output", text: line, key: `o${s}-${i}` });
    });
  });

  const lastStarted = rows.length > 0;
  const blinkOn = Math.floor(frame / 15) % 2 === 0;
  const visible = rows.slice(-MAX_VISIBLE_ROWS + 1);

  return (
    <Card label={title} badge="terminal">
      <div
        style={{
          padding: "28px 36px",
          fontFamily: theme.font.mono,
          fontSize: 30,
          lineHeight: "40px",
          color: theme.text,
          whiteSpace: "pre",
        }}
      >
        {visible.map((row) =>
          row.kind === "command" ? (
            <div key={row.key}>
              <span style={{ color: theme.prompt }}>{prompt} </span>
              <span>{row.text}</span>
              {row.typing ? <Cursor on /> : null}
            </div>
          ) : (
            <div key={row.key} style={{ color: outputColor(row.text) }}>
              {row.text || " "}
            </div>
          ),
        )}
        {cursorVisibleOnPrompt ? (
          <div>
            <span style={{ color: theme.prompt }}>{prompt} </span>
            <Cursor on={blinkOn || !lastStarted} />
          </div>
        ) : null}
      </div>
    </Card>
  );
};

const outputColor = (line: string) => {
  if (/^[A-Z][A-Z -]+(\s{2,}|$)/.test(line)) return theme.textDim; // table headers like NAME  READY
  if (/(created|configured|unchanged|successfully|Running)/.test(line)) return theme.text;
  if (/(error|Error|failed|CrashLoopBackOff)/.test(line)) return "#ff7a7a";
  return theme.text;
};

const Cursor: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    style={{
      display: "inline-block",
      width: 16,
      height: 32,
      marginLeft: 2,
      transform: "translateY(5px)",
      background: on ? theme.text : "transparent",
    }}
  />
);
