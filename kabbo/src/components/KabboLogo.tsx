import { cn } from '@/lib/utils';

interface KabboLogoProps {
  className?: string;
  size?: number;
}

/**
 * Kabbo logo — a stylised kanna flower (Sceletium tortuosum).
 *
 * Two interleaved rings of thin filament petals radiate from a small central
 * disc. The visual metaphor: many ideas funnelling inward to form a single
 * finished paper.
 *
 * Single-colour via `currentColor` so it themes with the rest of the app.
 */
export function KabboLogo({ className, size = 40 }: KabboLogoProps) {
  const cx = 24;
  const cy = 24;
  const petalCount = 32;

  // Outer ring — long petals, with a clear gap from the central disc
  const longPetals = Array.from({ length: petalCount }, (_, i) => {
    const angle = (i * 2 * Math.PI) / petalCount;
    return {
      key: `L${i}`,
      x1: cx + 8 * Math.cos(angle),
      y1: cy + 8 * Math.sin(angle),
      x2: cx + 23 * Math.cos(angle),
      y2: cy + 23 * Math.sin(angle),
    };
  });

  // Inner ring — shorter petals, offset by half a step to fill the gaps
  const shortPetals = Array.from({ length: petalCount }, (_, i) => {
    const angle = ((i + 0.5) * 2 * Math.PI) / petalCount;
    return {
      key: `S${i}`,
      x1: cx + 7.5 * Math.cos(angle),
      y1: cy + 7.5 * Math.sin(angle),
      x2: cx + 17.5 * Math.cos(angle),
      y2: cy + 17.5 * Math.sin(angle),
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-primary', className)}
    >
      {/* Long filament petals — outer ring */}
      {longPetals.map((p) => (
        <line
          key={p.key}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      ))}

      {/* Shorter filament petals — interleaved inner ring */}
      {shortPetals.map((p) => (
        <line
          key={p.key}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      ))}

      {/* Central disc — where the ideas converge */}
      <circle cx={cx} cy={cy} r={4.5} fill="currentColor" />
    </svg>
  );
}
