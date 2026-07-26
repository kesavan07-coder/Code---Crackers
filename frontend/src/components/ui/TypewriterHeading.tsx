"use client";

import { useEffect, useRef, useState, CSSProperties, ElementType } from "react";

interface TypewriterHeadingProps {
  /** Full text string to type out */
  text: string;
  /** Milliseconds per character (default: 35) */
  speed?: number;
  /** Delay before typing starts in ms (default: 400) */
  startDelay?: number;
  /** CSS color value for the blinking cursor (default: var(--accent-purple)) */
  cursorColor?: string;
  /** Optional HTML tag to render as (default: "span") */
  as?: ElementType;
  /** Extra className for the wrapper */
  className?: string;
  /** Extra inline styles for the wrapper */
  style?: CSSProperties;
  /** Callback fired when typing is complete */
  onComplete?: () => void;
}

/**
 * TypewriterHeading
 * ─────────────────
 * Renders text character-by-character with a blinking cursor.
 * Pure React / CSS — no third-party dependency required.
 *
 * Usage:
 *   <TypewriterHeading
 *     text="Initializing Competition..."
 *     speed={35}
 *     startDelay={400}
 *     cursorColor="var(--accent-purple)"
 *   />
 */
export default function TypewriterHeading({
  text,
  speed = 35,
  startDelay = 400,
  cursorColor = "var(--accent-purple)",
  as: Tag = "span",
  className = "",
  style,
  onComplete,
}: TypewriterHeadingProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone]           = useState(false);
  const indexRef                  = useRef(0);
  const timerRef                  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");
    setDone(false);

    // Start delay before first character
    timerRef.current = setTimeout(function tick() {
      const nextIndex = indexRef.current + 1;
      setDisplayed(text.slice(0, nextIndex));
      indexRef.current = nextIndex;

      if (nextIndex < text.length) {
        timerRef.current = setTimeout(tick, speed);
      } else {
        setDone(true);
        onComplete?.();
      }
    }, startDelay);

    return () => clearTimeout(timerRef.current);
  }, [text, speed, startDelay, onComplete]);

  return (
    <Tag className={className} style={style} aria-label={text} role="status">
      {displayed}
      {/* Blinking cursor — hidden once typing is done */}
      {!done && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "2px",
            height: "1.1em",
            background: cursorColor,
            marginLeft: "2px",
            verticalAlign: "text-bottom",
            animation: "blink-cursor 0.75s step-end infinite",
          }}
        />
      )}
    </Tag>
  );
}
