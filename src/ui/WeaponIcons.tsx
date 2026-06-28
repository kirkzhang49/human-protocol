interface WeaponIconProps {
  className?: string;
}

export function RodIcon({ className = "" }: WeaponIconProps) {
  return (
    <svg className={`weapon-glyph ${className}`.trim()} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-38 32 32)">
        <rect x="27" y="6" width="10" height="52" rx="5" fill="currentColor" opacity="0.9" />
        <rect x="24" y="4" width="16" height="8" rx="3" fill="currentColor" opacity="0.72" />
        <rect x="24" y="52" width="16" height="8" rx="3" fill="currentColor" opacity="0.72" />
        <rect x="26" y="17" width="12" height="4" rx="2" fill="#0a1116" opacity="0.46" />
        <rect x="26" y="34" width="12" height="4" rx="2" fill="#0a1116" opacity="0.42" />
        <path d="M34 8v48" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.34" />
      </g>
    </svg>
  );
}

export function PistolIcon({ className = "" }: WeaponIconProps) {
  return (
    <svg className={`weapon-glyph ${className}`.trim()} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M8 23h34c5 0 9 3 10 7l4 1v6h-19l-4 5h-8l-2-5h-7l-2-5H8z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M26 37h14l-6 19H23z" fill="currentColor" opacity="0.88" />
      <path d="M12 20h30l6 4H9z" fill="currentColor" opacity="0.62" />
      <path d="M21 38c1 4 4 6 8 6" fill="none" stroke="#0a1116" strokeWidth="3" strokeLinecap="round" opacity="0.42" />
      <path d="M15 27h26" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.24" />
      <rect x="48" y="28" width="10" height="5" rx="2" fill="currentColor" opacity="0.76" />
    </svg>
  );
}

export function CoreCellIcon({ className = "" }: WeaponIconProps) {
  return (
    <svg className={`weapon-glyph ${className}`.trim()} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="21" y="7" width="22" height="6" rx="2" fill="currentColor" opacity="0.78" />
      <rect x="18" y="12" width="28" height="44" rx="5" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.88" />
      <rect x="22" y="18" width="20" height="32" rx="3" fill="currentColor" opacity="0.2" />
      <path d="M27 23h10l-2 10h5L29 47l2-11h-6z" fill="currentColor" opacity="0.94" />
      <path d="M22 17h20M22 51h20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.22" />
    </svg>
  );
}
