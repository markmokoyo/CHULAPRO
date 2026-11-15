"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}

/**
 * Interactive card that renders a subtle cursor-following radial spotlight on desktop pointers.
 * Gracefully disables motion when prefers-reduced-motion is active or on touch-only pointers.
 */
export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(236, 61, 106, 0.12)",
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          setIsHovered(true);
        }
      }}
      onPointerLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:hidden"
        style={{
          opacity: isHovered && coords ? 1 : 0,
          background: coords
            ? `radial-gradient(380px circle at ${coords.x}px ${coords.y}px, ${spotlightColor}, transparent 70%)`
            : "none",
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}

/**
 * Lightweight IntersectionObserver wrapper for staggered UXpert-style scroll reveals.
 */
export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -24px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
