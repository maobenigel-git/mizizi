"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Character artwork from public/assets. If the file hasn't been added yet the
 * image simply doesn't render, so pages look complete either way.
 */
export function CharacterImage({
  src,
  name,
  className = "",
  fallback = null,
}: {
  src: string | undefined;
  name: string;
  className?: string;
  /** Rendered instead when the file is absent (e.g. the text wordmark for the logo). */
  fallback?: React.ReactNode;
}) {
  const [missing, setMissing] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A 404 that lands before hydration never fires onError, so check once on mount.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setMissing(true);
  }, []);
  if (!src || missing) return fallback;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- user-supplied art of unknown size; must fail silently
    <img ref={img} src={src} alt={name} onError={() => setMissing(true)} className={`object-contain ${className}`} />
  );
}
