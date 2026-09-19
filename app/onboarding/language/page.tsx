import { LanguagePicker } from "@/components/onboarding/LanguagePicker";
import { listFamilies, listLanguages } from "@/lib/db/languages";
import { getSession } from "@/lib/session";

export default async function LanguageStepPage() {
  const [languages, families, session] = await Promise.all([listLanguages(), listFamilies(), getSession()]);
  return (
    <div className="flex flex-1 flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a language</h1>
      <LanguagePicker languages={languages} families={families} initial={session.languageId} />
    </div>
  );
}
