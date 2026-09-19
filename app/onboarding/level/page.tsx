import { chooseLevel } from "@/lib/session/actions";
import { getLanguage } from "@/lib/db/languages";
import { getSession } from "@/lib/session";

const levels = [
  { value: "beginner", title: "New to this language", detail: "Start from the very beginning." },
  { value: "intermediate", title: "I understand some", detail: "I follow conversations but want to say more." },
  { value: "advanced", title: "I speak it, want to read & write", detail: "Focus on reading and writing." },
];

export default async function LevelPage() {
  const session = await getSession();
  const language = session.languageId ? await getLanguage(session.languageId) : undefined;

  return (
    <form action={chooseLevel} className="flex flex-1 flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">How much {language?.name ?? "of it"} do you know?</h1>
        <p className="text-muted">Pick the closest fit. You can change it later in your profile.</p>
      </header>
      <div className="space-y-3">
        {levels.map((level) => (
          <button
            key={level.value}
            type="submit"
            name="level"
            value={level.value}
            className="glass !rounded-xl w-full border-2 p-4 text-left transition-colors duration-200 ease-out hover:border-ocean"
          >
            <span className="block font-medium">{level.title}</span>
            <span className="block text-sm text-muted">{level.detail}</span>
          </button>
        ))}
      </div>
    </form>
  );
}
