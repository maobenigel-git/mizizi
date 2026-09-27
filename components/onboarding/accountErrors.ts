import type { AccountError } from "@/lib/session/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/session/contact";

// The sentence for each ?error= code the account actions redirect with.
const messages: Record<AccountError, string> = {
  contact: "Enter a phone number (07XX XXX XXX or +254…) or an email address.",
  password: `Use a password of at least ${PASSWORD_MIN_LENGTH} characters.`,
  taken: "There is already an account with that phone number or email.",
  credentials: "That phone number or email and password don't match an account.",
  limited: "Too many attempts. Wait fifteen minutes and try again.",
};

export function accountErrorMessage(code: unknown): string | undefined {
  return typeof code === "string" && code in messages ? messages[code as AccountError] : undefined;
}
