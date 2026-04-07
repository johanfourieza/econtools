import { cn } from '@/lib/utils';

interface KabboLogoProps {
  className?: string;
  size?: number;
}

export function KabboLogo({ className, size = 40 }: KabboLogoProps) {
  // Center point is x=22, all elements are perfectly mirrored
  return (
    <svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 44 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-primary', className)}
    >
      {/* Eye/lens shape - perfectly symmetrical around x=22 */}
      <path
        d="M2 12 C12 4 32 4 42 12 C32 20 12 20 2 12 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Left funnel line - mirrored with right */}
      <path
        d="M6 12 C12 22 18 30 22 36"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right funnel line - mirrored with left */}
      <path
        d="M38 12 C32 22 26 30 22 36"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Output box - centered at x=22 */}
      <rect
        x="16"
        y="40"
        width="12"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  );
}
