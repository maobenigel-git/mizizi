"use server";

import { revalidatePath } from "next/cache";
import { parseServiceAccount } from "@/lib/speech/google-auth";
import { runCheck, type CheckResult } from "./checks";
import { invalidValue, readEnvFile, writeEnvValues } from "./env-file";
import { services } from "./services";
import { validSetupToken } from "./setup-access";

/*
 * The setup screen's writes. Every action re-checks the dev-only token: a
 * server action is an HTTP endpoint, and the page hiding its buttons is not
 * protection on its own.
 */

export type SaveResult = { ok: boolean; message: string };

const denied: SaveResult = { ok: false, message: "Not allowed. Open the setup link printed in your terminal." };

export async function saveService(token: string, serviceId: string, formData: FormData): Promise<SaveResult> {
  if (!validSetupToken(token)) return denied;
  const service = services.find((s) => s.id === serviceId);
  if (!service) return { ok: false, message: "Unknown service." };

  const updates: Record<string, string> = {};
  for (const field of service.fields) {
    const value = String(formData.get(field.key) ?? "").trim();
    // Empty means "leave what's saved": secrets are never sent back to the page to re-submit.
    if (!value) continue;

    if (field.kind === "json") {
      const account = parseServiceAccount(value);
      if (!account) return { ok: false, message: `${field.label}: paste the whole service-account .json file.` };
      // Stored base64: one line, no quotes or backslashes to escape.
      updates[field.key] = Buffer.from(JSON.stringify(account)).toString("base64");
      continue;
    }
    if (field.kind === "url") {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
      } catch {
        return { ok: false, message: `${field.label}: that isn't a web address (https://…).` };
      }
    }
    if (field.kind === "select" && field.options && !field.options.includes(value)) {
      return { ok: false, message: `${field.label}: choose one of ${field.options.join(", ")}.` };
    }
    const problem = invalidValue(value);
    if (problem) return { ok: false, message: `${field.label} ${problem}.` };
    updates[field.key] = value;
  }

  if (Object.keys(updates).length === 0) return { ok: false, message: "Nothing to save — the fields are empty." };
  try {
    writeEnvValues(updates);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
  revalidatePath("/setup");
  return { ok: true, message: `Saved ${Object.keys(updates).join(", ")} to .env.local.` };
}

export async function clearKey(token: string, key: string): Promise<SaveResult> {
  if (!validSetupToken(token)) return denied;
  if (!services.some((s) => s.fields.some((f) => f.key === key))) return { ok: false, message: "Unknown setting." };
  writeEnvValues({ [key]: null });
  revalidatePath("/setup");
  return { ok: true, message: `Removed ${key}.` };
}

export async function checkService(token: string, serviceId: string): Promise<CheckResult> {
  if (!validSetupToken(token)) return denied;
  // Read the file, not process.env: the server may not have reloaded yet.
  return runCheck(serviceId, readEnvFile());
}
