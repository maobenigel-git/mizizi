import type { CoverageTier } from "@/types";

const labels: Record<CoverageTier, string> = {
  full: "Full",
  developing: "Developing",
  heritage: "Heritage",
};

const styles: Record<CoverageTier, string> = {
  full: "bg-forest/15 text-forest",
  developing: "bg-ocean/15 text-ocean",
  heritage: "bg-earth/15 text-earth",
};

export function CoverageBadge({ tier }: { tier: CoverageTier }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[tier]}`}>
      {labels[tier]}
    </span>
  );
}
