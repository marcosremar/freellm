export function FreeLLMLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="hsl(150 100% 40% / 0.15)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="hsl(150 100% 40% / 0.4)" />
      <circle cx="7" cy="16" r="2" fill="hsl(150 100% 40%)" />
      <circle cx="25" cy="10" r="2" fill="hsl(150 100% 40%)" />
      <circle cx="25" cy="22" r="2" fill="hsl(150 100% 40%)" />
      <circle cx="16" cy="16" r="1.5" fill="hsl(150 100% 40% / 0.6)" />
      <line x1="9" y1="15.5" x2="14.5" y2="15" stroke="hsl(150 100% 40%)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="17.5" y1="15" x2="23" y2="10.5" stroke="hsl(150 100% 40%)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="17.5" y1="17" x2="23" y2="21.5" stroke="hsl(150 100% 40%)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="23" y1="8" x2="27" y2="10" stroke="hsl(150 100% 40% / 0.4)" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="23" y1="20" x2="27" y2="22" stroke="hsl(150 100% 40% / 0.4)" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}
