/*
 * Illustrations for the Home feature cards, drawn in the brand palette.
 *
 * Placeholders for proper 3D renders: drop a PNG at
 * public/assets/features/<id>.png (lessons, tutor, translate, notebook,
 * languages, culture, literature, community) and the card uses it instead —
 * see components/today/FeatureRail.tsx. No code change needed.
 *
 * These are artwork, not UI, so their shades are fixed like an image's would
 * be — the no-hard-coded-colours rule (CLAUDE.md) is about interface chrome.
 */

export type FeatureArtId = "lessons" | "tutor" | "translate" | "notebook" | "languages" | "culture" | "literature" | "community";

const shadow = "h-full w-full drop-shadow-[0_8px_10px_rgb(90_40_10/0.28)]";

function OpenBook() {
  return (
    <svg viewBox="0 0 120 90" className={shadow} aria-hidden>
      <defs>
        <linearGradient id="fa-book-cover" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a3d12" />
          <stop offset="1" stopColor="#5c2208" />
        </linearGradient>
        <linearGradient id="fa-book-page" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#efdcb8" />
        </linearGradient>
        <linearGradient id="fa-book-pic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcf6b" />
          <stop offset="1" stopColor="#3f7a45" />
        </linearGradient>
      </defs>
      <path d="M6 34 Q60 20 114 34 L110 82 Q60 70 10 82 Z" fill="url(#fa-book-cover)" />
      <path d="M12 30 Q36 20 60 32 L59 76 Q36 64 15 72 Z" fill="url(#fa-book-page)" />
      <path d="M60 32 Q84 20 108 30 L105 72 Q84 64 59 76 Z" fill="url(#fa-book-page)" />
      <path d="M60 32 L59 76" stroke="#c9a877" strokeWidth="1.2" />
      {[40, 47, 54, 61].map((y, i) => (
        <path key={y} d={`M20 ${y - i * 0.4} Q36 ${y - 8 - i * 0.2} 53 ${y - 1}`} stroke="#b89a6e" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ))}
      <path d="M67 36 Q84 28 100 34 L98 58 Q84 52 66 60 Z" fill="url(#fa-book-pic)" />
      <circle cx="90" cy="40" r="4" fill="#fff4d6" />
      <path d="M67 60 L76 48 L84 56 L91 49 L98 58 Q84 52 67 60 Z" fill="#2f5f35" />
    </svg>
  );
}

function Robot() {
  return (
    <svg viewBox="0 0 100 100" className={shadow} aria-hidden>
      <defs>
        <linearGradient id="fa-bot-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf8" />
          <stop offset="1" stopColor="#e9dcc8" />
        </linearGradient>
        <radialGradient id="fa-bot-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd46b" />
          <stop offset="1" stopColor="#ffaf00" />
        </radialGradient>
      </defs>
      <line x1="30" y1="14" x2="34" y2="26" stroke="#5c2208" strokeWidth="3" strokeLinecap="round" />
      <line x1="70" y1="14" x2="66" y2="26" stroke="#5c2208" strokeWidth="3" strokeLinecap="round" />
      <circle cx="29" cy="12" r="5" fill="url(#fa-bot-glow)" />
      <circle cx="71" cy="12" r="5" fill="url(#fa-bot-glow)" />
      <rect x="10" y="40" width="12" height="24" rx="6" fill="#8a3312" />
      <rect x="78" y="40" width="12" height="24" rx="6" fill="#8a3312" />
      <rect x="18" y="24" width="64" height="54" rx="22" fill="url(#fa-bot-shell)" />
      <rect x="26" y="34" width="48" height="30" rx="14" fill="#3d1508" />
      <ellipse cx="41" cy="47" rx="5" ry="6" fill="url(#fa-bot-glow)" />
      <ellipse cx="59" cy="47" rx="5" ry="6" fill="url(#fa-bot-glow)" />
      <path d="M43 56 Q50 61 57 56" stroke="#ffaf00" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M30 80 Q50 72 70 80 L72 96 L28 96 Z" fill="url(#fa-bot-shell)" />
      <circle cx="50" cy="86" r="4" fill="#d34a24" />
    </svg>
  );
}

function Globe() {
  return (
    <svg viewBox="0 0 110 100" className={shadow} aria-hidden>
      <defs>
        <radialGradient id="fa-globe" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#e9a24a" />
          <stop offset="0.6" stopColor="#9a4a14" />
          <stop offset="1" stopColor="#5c2208" />
        </radialGradient>
      </defs>
      <circle cx="52" cy="58" r="36" fill="url(#fa-globe)" />
      <path d="M30 40 Q40 32 50 38 Q46 48 54 52 Q48 62 38 58 Q30 52 30 40 Z" fill="#3f7a45" />
      <path d="M58 30 Q72 30 80 42 Q72 46 70 56 Q62 50 60 42 Z" fill="#3f7a45" />
      <path d="M50 70 Q62 66 70 76 Q62 88 52 86 Q54 78 50 70 Z" fill="#3f7a45" />
      <ellipse cx="52" cy="58" rx="36" ry="12" fill="none" stroke="#ffd9a0" strokeOpacity="0.45" strokeWidth="1.5" />
      <g>
        <rect x="4" y="10" width="30" height="24" rx="7" fill="#fff4dc" />
        <path d="M12 34 L10 42 L20 34 Z" fill="#fff4dc" />
        <text x="19" y="28" textAnchor="middle" fontSize="16" fontWeight="700" fill="#3d1508" fontFamily="system-ui, sans-serif">A</text>
      </g>
      <g>
        <rect x="74" y="6" width="32" height="24" rx="7" fill="#ffaf00" />
        <path d="M94 30 L98 38 L86 30 Z" fill="#ffaf00" />
        <text x="90" y="24" textAnchor="middle" fontSize="14" fontWeight="700" fill="#3d1508" fontFamily="system-ui, sans-serif">+A</text>
      </g>
    </svg>
  );
}

function SpiralNotebook() {
  return (
    <svg viewBox="0 0 100 100" className={shadow} aria-hidden>
      <defs>
        <linearGradient id="fa-note" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#ecd6ad" />
        </linearGradient>
        <linearGradient id="fa-pen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d34a24" />
          <stop offset="1" stopColor="#7a2a0c" />
        </linearGradient>
      </defs>
      <g transform="rotate(-10 50 55)">
        <rect x="18" y="14" width="60" height="78" rx="6" fill="#8a3312" />
        <rect x="22" y="12" width="58" height="78" rx="5" fill="url(#fa-note)" />
        {[26, 36, 46, 56, 66, 76].map((y) => (
          <line key={y} x1="32" y1={y} x2="72" y2={y} stroke="#c9a877" strokeWidth="1.4" />
        ))}
        {[18, 28, 38, 48, 58, 68, 78].map((y) => (
          <rect key={y} x="17" y={y} width="10" height="4" rx="2" fill="none" stroke="#5c2208" strokeWidth="2" />
        ))}
      </g>
      <g transform="rotate(38 72 50)">
        <rect x="66" y="8" width="10" height="68" rx="4" fill="url(#fa-pen)" />
        <path d="M66 76 L76 76 L71 90 Z" fill="#f3d9a8" />
        <path d="M69.5 84 L72.5 84 L71 90 Z" fill="#3d1508" />
        <rect x="66" y="16" width="10" height="4" fill="#ffaf00" />
      </g>
    </svg>
  );
}

function Bubbles() {
  return (
    <svg viewBox="0 0 110 90" className={shadow} aria-hidden>
      <rect x="6" y="14" width="56" height="38" rx="12" fill="#316e38" />
      <path d="M18 52 L14 64 L30 52 Z" fill="#316e38" />
      <text x="34" y="39" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">Habari</text>
      <rect x="44" y="40" width="60" height="38" rx="12" fill="#ffaf00" />
      <path d="M92 78 L96 88 L82 78 Z" fill="#ffaf00" />
      <text x="74" y="65" textAnchor="middle" fontSize="15" fontWeight="700" fill="#3d1508" fontFamily="system-ui, sans-serif">Wĩmwega</text>
    </svg>
  );
}

function Drum() {
  return (
    <svg viewBox="0 0 100 100" className={shadow} aria-hidden>
      <defs>
        <linearGradient id="fa-drum" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5c2208" />
          <stop offset="0.5" stopColor="#a8481a" />
          <stop offset="1" stopColor="#5c2208" />
        </linearGradient>
      </defs>
      <path d="M22 26 L78 26 L68 90 L32 90 Z" fill="url(#fa-drum)" />
      <ellipse cx="50" cy="26" rx="28" ry="9" fill="#f3d9a8" stroke="#5c2208" strokeWidth="2" />
      {[34, 44, 54, 64].map((x) => (
        <path key={x} d={`M${x - 8} 33 L${x} 88`} stroke="#ffaf00" strokeWidth="1.6" />
      ))}
      <path d="M24 58 Q50 66 76 58" stroke="#d34a24" strokeWidth="4" fill="none" />
    </svg>
  );
}

function BookStack() {
  return (
    <svg viewBox="0 0 100 90" className={shadow} aria-hidden>
      <rect x="12" y="62" width="76" height="16" rx="3" fill="#316e38" />
      <rect x="12" y="62" width="8" height="16" fill="#1c3d20" />
      <rect x="18" y="44" width="70" height="16" rx="3" fill="#d34a24" transform="rotate(-4 50 52)" />
      <rect x="22" y="26" width="62" height="16" rx="3" fill="#ffaf00" transform="rotate(3 50 34)" />
      <rect x="22" y="31" width="62" height="3" fill="#fff4dc" opacity="0.7" transform="rotate(3 50 34)" />
      <rect x="18" y="49" width="70" height="3" fill="#fff4dc" opacity="0.6" transform="rotate(-4 50 52)" />
    </svg>
  );
}

function People() {
  return (
    <svg viewBox="0 0 110 90" className={shadow} aria-hidden>
      <circle cx="30" cy="30" r="12" fill="#a8481a" />
      <path d="M10 76 Q12 50 30 48 Q48 50 50 76 Z" fill="#316e38" />
      <circle cx="80" cy="30" r="12" fill="#7a3510" />
      <path d="M60 76 Q62 50 80 48 Q98 50 100 76 Z" fill="#d34a24" />
      <circle cx="55" cy="38" r="14" fill="#8a3d15" />
      <path d="M32 88 Q34 58 55 56 Q76 58 78 88 Z" fill="#ffaf00" />
    </svg>
  );
}

export const featureArt: Record<FeatureArtId, () => React.JSX.Element> = {
  lessons: OpenBook,
  tutor: Robot,
  translate: Globe,
  notebook: SpiralNotebook,
  languages: Bubbles,
  culture: Drum,
  literature: BookStack,
  community: People,
};
