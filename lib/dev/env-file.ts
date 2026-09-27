import "server-only";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/*
 * Reads and edits .env.local for the local setup screen. Development only.
 *
 * .env.local is git-ignored (the `.env*` rule in .gitignore), so keys saved
 * here never reach the repository. Production reads the same names from the
 * host's environment settings instead.
 *
 * Format, from how Next's loader actually parses (tested, not assumed):
 *   - values are written in double quotes, so `#` isn't read as a comment;
 *   - `$` is written as `\$`, because the loader expands $VARIABLES even
 *     inside single quotes — an unescaped `$` silently eats part of a password;
 *   - `"`, `\` and line breaks are refused: the loader leaves `\"` escaped and
 *     turns `\n` into a newline, so they can't round-trip. Keys and URLs never
 *     contain them; a password that does can be URL-encoded.
 */

export const ENV_FILE = path.join(process.cwd(), ".env.local");
const SETUP_HEADING = "# Added by the setup screen (/setup)";

function readRaw(): string {
  try {
    return readFileSync(ENV_FILE, "utf8");
  } catch {
    return "";
  }
}

/** The value as the app will see it: quotes removed, `\$` unescaped. */
function decode(raw: string): string {
  const value = raw.trim();
  const quoted = value.match(/^"(.*)"$/) ?? value.match(/^'(.*)'$/);
  if (quoted) return quoted[1].replace(/\\\$/g, "$");
  return value.replace(/\s+#.*$/, "").replace(/\\\$/g, "$");
}

export function readEnvFile(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readRaw().split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match) values[match[1]] = decode(match[2]);
  }
  return values;
}

export function invalidValue(value: string): string | undefined {
  if (/[\r\n]/.test(value)) return "can't contain line breaks";
  if (value.includes('"') || value.includes("\\")) return 'can\'t contain " or \\ — URL-encode them (%22, %5C)';
  if (/[\u0000-\u001f]/.test(value)) return "contains control characters";
  return undefined;
}

const encode = (value: string) => `"${value.replace(/\$/g, "\\$")}"`;

/**
 * Sets (string) or removes (null) keys. Existing lines are edited in place so
 * comments and the dev flags survive; new keys are appended in one block.
 */
export function writeEnvValues(updates: Record<string, string | null>): void {
  for (const [key, value] of Object.entries(updates)) {
    const problem = value === null ? undefined : invalidValue(value);
    if (problem) throw new Error(`${key} ${problem}.`);
  }

  const lines = readRaw().split(/\r?\n/);
  const pending = new Map(Object.entries(updates));
  const out: string[] = [];
  for (const line of lines) {
    const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (key && pending.has(key)) {
      const value = pending.get(key)!;
      pending.delete(key);
      if (value !== null) out.push(`${key}=${encode(value)}`);
      continue;
    }
    out.push(line);
  }
  const added = [...pending].filter(([, value]) => value !== null);
  if (added.length) {
    while (out.length && out[out.length - 1].trim() === "") out.pop();
    if (!out.includes(SETUP_HEADING)) out.push("", SETUP_HEADING);
    for (const [key, value] of added) out.push(`${key}=${encode(value!)}`);
  }

  // Write-then-rename, so a crash can't leave a half-written env file.
  const temp = `${ENV_FILE}.${process.pid}.tmp`;
  writeFileSync(temp, `${out.join("\n").replace(/\n*$/, "")}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temp, ENV_FILE);

  // Prove it round-trips exactly as saved.
  const saved = readEnvFile();
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && saved[key] !== value) throw new Error(`${key} didn't save correctly — check .env.local.`);
  }
}
