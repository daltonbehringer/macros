import type { ReactElement } from "react";

/**
 * The macros app icon: a single bold "m" in accent green on a near-black
 * background. Single source of truth for every icon route — favicon, iOS
 * apple-touch-icon, and the Android PWA 192/512 sizes all render this.
 *
 * Designed for ImageResponse from next/og: returns plain JSX with inline
 * styles, no Tailwind, no external font (system-ui renders cleanly enough at
 * every size we ship and avoids ImageResponse font-fetching cost).
 */
export function Mark({ size }: { size: number }): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0b",
        color: "#00e08a",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontWeight: 700,
        fontSize: Math.round(size * 0.7),
        lineHeight: 1,
        letterSpacing: "-0.04em",
        // Optical centering: lowercase "m" sits visually low; nudge up.
        paddingBottom: Math.round(size * 0.06),
      }}
    >
      m
    </div>
  );
}
