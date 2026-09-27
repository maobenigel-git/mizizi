import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone is used by pronunciation practice, on this origin only.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/*
 * Development only: hosts other than localhost that may load the dev server's
 * scripts. Without this, opening the app from the "Network:" address (or a
 * phone on the same Wi-Fi) serves the HTML but blocks the JavaScript, so
 * nothing interactive works — buttons do nothing and inputs never enable.
 *
 * This machine's own LAN addresses are allowed automatically, since they
 * change between networks; DEV_ALLOWED_ORIGINS adds any others (comma-separated
 * hostnames, e.g. a tunnel). `next build` / `next start` ignore this setting.
 */
function devOrigins(): string[] {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address);
  const extra = (process.env.DEV_ALLOWED_ORIGINS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  return [...new Set([...lan, ...extra])];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: devOrigins(),
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
