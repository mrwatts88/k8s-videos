import React from "react";
import { theme } from "../theme";

/** A window-style card with a header strip, used by terminal and code scenes. */
export const Card: React.FC<{
  label: string;
  badge?: string;
  width?: number;
  height?: number;
  children: React.ReactNode;
}> = ({ label, badge, width = 1500, height = 760, children }) => (
  <div
    style={{
      width,
      height,
      background: theme.card,
      border: `2px solid ${theme.cardBorder}`,
      borderRadius: 22,
      boxShadow: "0 40px 120px rgba(0, 0, 0, 0.55)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        height: 64,
        flexShrink: 0,
        background: theme.cardHeader,
        borderBottom: `2px solid ${theme.cardBorder}`,
        display: "flex",
        alignItems: "center",
        padding: "0 26px",
        gap: 12,
      }}
    >
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c, opacity: 0.9 }} />
      ))}
      <div
        style={{
          marginLeft: 18,
          fontFamily: theme.font.mono,
          fontSize: 24,
          color: theme.textDim,
          flex: 1,
        }}
      >
        {label}
      </div>
      {badge ? (
        <div
          style={{
            fontFamily: theme.font.sans,
            fontWeight: 600,
            fontSize: 20,
            color: theme.accent,
            background: theme.accentSoft,
            padding: "6px 14px",
            borderRadius: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {badge}
        </div>
      ) : null}
    </div>
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
  </div>
);
