import { execFileSync } from "node:child_process";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceCard, type FieldStatus } from "@/components/dev/ServiceCard";
import { readEnvFile } from "@/lib/dev/env-file";
import { services, type ServiceField } from "@/lib/dev/services";
import { SETUP_ENABLED, validSetupToken } from "@/lib/dev/setup-access";
import { parseServiceAccount } from "@/lib/speech/google-auth";

export const metadata: Metadata = { title: "API setup · Mizizi", robots: { index: false } };

/*
 * Local setup screen: add each API key, check it works, save to .env.local.
 * Exists only under `next dev`, and only with the one-time link printed in
 * the terminal (lib/dev/setup-access). Production uses the host's settings.
 */

/** A hint of what's saved, never the secret itself. */
function preview(field: ServiceField, value: string): string {
  if (field.kind === "json") return parseServiceAccount(value)?.client_email ?? "a key";
  if (field.kind === "url" || field.kind === "text" || field.kind === "select") return value;
  if (field.key === "DATABASE_URL") {
    try {
      return `…@${new URL(value).host}`;
    } catch {
      return "set";
    }
  }
  return value.length > 8 ? `••••${value.slice(-4)}` : "••••";
}

function gitIgnoresEnvFile(): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", ".env.local"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export default async function SetupPage({ searchParams }: PageProps<"/setup">) {
  if (!SETUP_ENABLED) notFound();
  const { token } = await searchParams;

  if (!validSetupToken(token)) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">API setup</h1>
        <p className="text-muted">
          Open the setup link printed in the terminal where <code>npm run dev</code> is running — it looks like
          <code className="mt-2 block break-all rounded-[var(--radius-control)] bg-[var(--glass-inset-bg)] px-3 py-2 text-sm">
            http://localhost:3000/setup?token=…
          </code>
        </p>
        <p className="text-sm text-muted">
          The token keeps anyone else on your Wi-Fi from changing your keys. It changes each time the dev server restarts.
        </p>
      </main>
    );
  }

  const env = readEnvFile();
  const status = (service: (typeof services)[number]) =>
    Object.fromEntries(
      service.fields.map((f): [string, FieldStatus] => [f.key, env[f.key] ? { set: true, preview: preview(f, env[f.key]) } : { set: false }]),
    );
  const ignored = gitIgnoresEnvFile();
  const required = services.filter((s) => s.required);
  const optional = services.filter((s) => !s.required);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-3">
        <p className="text-sm font-medium text-accent">Local development only</p>
        <h1 className="text-3xl font-semibold tracking-tight">API setup</h1>
        <p className="text-muted">
          Paste each key, press Save, and it&apos;s checked straight away. Keys are written to <code>.env.local</code> in this
          project and never shown again in full.
        </p>
        <p
          className={`rounded-[var(--radius-control)] px-4 py-3 text-sm ${ignored ? "bg-forest/10 text-forest" : "bg-red/10 text-red"}`}
        >
          {ignored
            ? "✓ .env.local is ignored by git — your keys won't be committed or pushed."
            : "⚠ git is NOT ignoring .env.local. Add .env* to .gitignore before saving keys."}
        </p>
        <p className="text-sm text-muted">
          After saving, restart <code>npm run dev</code> so every part of the app picks the new values up. For a live
          deployment, add the same names in your host&apos;s environment settings (on Vercel: Project → Settings →
          Environment Variables) — this screen doesn&apos;t exist there. Full guide: <code>docs/api-setup.md</code>.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Required for a live deployment</h2>
        {required.map((s) => (
          <ServiceCard key={s.id} service={s} status={status(s)} token={token as string} />
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Optional — each switches on a feature</h2>
        {optional.map((s) => (
          <ServiceCard key={s.id} service={s} status={status(s)} token={token as string} />
        ))}
      </section>
    </main>
  );
}
