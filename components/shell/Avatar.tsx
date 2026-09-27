import type { AvatarColor } from "@/lib/session/types";

/*
 * The four avatar choices, one per brand colour. The keys are stored in
 * learners' sessions, so they keep their old names: with the brand palette
 * "ocean" and "forest" are both green, so "forest" now shows the ember.
 */
export const avatarStyles: Record<AvatarColor, string> = {
  ocean: "bg-ocean",
  earth: "bg-earth",
  forest: "bg-red",
  deep: "bg-ocean-dark",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, color, size = "md" }: { name: string; color: AvatarColor; size?: "sm" | "md" | "lg" }) {
  const dimensions = { sm: "h-6 w-6 text-[10px]", md: "h-9 w-9 text-sm", lg: "h-14 w-14 text-lg" }[size];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dimensions} ${avatarStyles[color]}`}
    >
      {initials(name) || "?"}
    </span>
  );
}
