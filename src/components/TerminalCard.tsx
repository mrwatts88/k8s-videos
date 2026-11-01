import React from "react";
import { interpolate } from "remotion";
import { terminalFrames, typingFrames } from "../lib/timeline";
import { theme } from "../theme";
import { Card } from "./Card";

export type TimedStep = {
  /** Scene-relative frame where typing starts. */
  startFrame: number;
  command: string;
  output: string[];
};

// Typing speed, the beat before output and the stagger come from src/timing.json,
// which the narration timeline also uses to hold the next line until output is readable.
const MAX_VISIBLE_ROWS = 17;

type Row = { kind: "command" | "output"; text: string; key: string; typing?: boolean; solid?: boolean };

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
    const typeStart = step.startFrame + terminalFrames.typeDelay;
    if (frame < typeStart) return;
    const total = typingFrames(step.command);
    const progress = interpolate(frame, [typeStart, typeStart + total], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const typed = step.command.slice(0, Math.round(progress * step.command.length));
    const outStart = typeStart + total + terminalFrames.beat;
    // While typing, and during the beat before output, the cursor stays on the command line.
    const busy = frame < outStart;
    rows.push({ kind: "command", text: typed, key: `c${s}`, typing: busy, solid: progress < 1 });
    if (busy) {
      cursorVisibleOnPrompt = false;
      return;
    }
    step.output.forEach((line, i) => {
      if (frame >= outStart + i * terminalFrames.stagger) rows.push({ kind: "output", text: line, key: `o${s}-${i}` });
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
              {row.typing ? <Cursor on={row.solid || frame % 30 < 20} /> : null}
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
