import React from "react";
import { Easing, interpolate } from "remotion";
import { theme } from "../theme";

export const TitleCard: React.FC<{ frame: number; kicker?: string; title: string; subtitle?: string }> = ({
  frame,
  kicker,
  title,
  subtitle,
}) => {
  const rise = (delay: number) => {
    const p = interpolate(frame, [delay, delay + 20], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    return { opacity: p, transform: `translateY(${(1 - p) * 30}px)` };
  };
  return (
    <div style={{ textAlign: "center", fontFamily: theme.font.sans, maxWidth: 1500 }}>
      {kicker ? (
        <div
          style={{
            ...rise(0),
            color: theme.accent,
            fontWeight: 600,
            fontSize: 34,
            letterSpacing: 6,
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          {kicker}
        </div>
      ) : null}
      <div style={{ ...rise(6), color: theme.text, fontWeight: 700, fontSize: 96, lineHeight: 1.08 }}>{title}</div>
      {subtitle ? (
        <div style={{ ...rise(14), color: theme.textDim, fontSize: 42, marginTop: 30, lineHeight: 1.35 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
