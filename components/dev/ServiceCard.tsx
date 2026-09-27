"use client";

import { useState, useTransition } from "react";
import type { Service, ServiceField } from "@/lib/dev/services";
import { checkService, clearKey, saveService, type SaveResult } from "@/lib/dev/setup-actions";

/*
 * One service on the setup screen. Saved secrets are never sent back to the
 * browser — only a masked hint — so an empty field means "keep what's saved".
 */

export type FieldStatus = { set: boolean; preview?: string };

const input =
  "glass-inset w-full px-3 py-2.5 text-sm outline-none transition-all duration-200 ease-out focus:border-accent";

function randomSecret(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
}

export function ServiceCard({ service, status, token }: { service: Service; status: Record<string, FieldStatus>; token: string }) {
  const [message, setMessage] = useState<SaveResult | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [busy, start] = useTransition();

  const essential = service.fields.filter((f) => !f.optional);
  const configured = essential.every((f) => status[f.key]?.set);
  const partial = !configured && service.fields.some((f) => status[f.key]?.set);

  function save() {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    start(async () => {
      const result = await saveService(token, service.id, form);
      setMessage(result);
      if (result.ok) {
        setValues({});
        // Confirm it works straight away where there's something to check.
        setMessage({ ok: true, message: `${result.message} Checking…` });
        const check = await checkService(token, service.id);
        setMessage({ ok: check.ok, message: `${result.message} ${check.message}` });
      }
    });
  }

  function check() {
    start(async () => setMessage(await checkService(token, service.id)));
  }

  function remove(key: string) {
    start(async () => setMessage(await clearKey(token, key)));
  }

  return (
    <section className="glass space-y-4 p-5" aria-labelledby={`${service.id}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`${service.id}-title`} className="text-lg font-semibold">
            {service.title}
          </h2>
          <p className="text-sm text-muted">{service.purpose}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            configured ? "bg-forest text-white" : partial ? "bg-gold/25 text-foreground" : "bg-[var(--glass-inset-bg)] text-muted"
          }`}
        >
          {configured ? "Saved" : partial ? "Partly set" : service.required ? "Required" : "Optional"}
        </span>
      </header>

      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Without it: </dt>
          <dd className="inline text-muted">{service.without}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Cost: </dt>
          <dd className="inline text-muted">{service.cost}</dd>
        </div>
      </dl>

      <ol className="list-decimal space-y-1.5 pl-5 text-sm">
        {service.steps.map((step, i) => (
          <li key={i}>
            {step.text}{" "}
            {step.link && (
              <a href={step.link} target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:underline">
                Open ↗
              </a>
            )}
          </li>
        ))}
      </ol>

      <div className="space-y-3">
        {service.fields.map((field) => (
          <Field
            key={field.key}
            field={field}
            status={status[field.key]}
            value={values[field.key] ?? ""}
            shown={Boolean(shown[field.key])}
            onChange={(value) => setValues((v) => ({ ...v, [field.key]: value }))}
            onToggle={() => setShown((s) => ({ ...s, [field.key]: !s[field.key] }))}
            onGenerate={() => setValues((v) => ({ ...v, [field.key]: randomSecret() }))}
            onRemove={() => remove(field.key)}
            disabled={busy}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || Object.values(values).every((v) => !v.trim())}
          className="press rounded-[var(--radius-control)] bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Working…" : "Save"}
        </button>
        <button
          type="button"
          onClick={check}
          disabled={busy}
          className="press rounded-[var(--radius-control)] border-2 border-accent px-5 py-2 text-sm font-semibold text-accent transition-all duration-200 ease-out hover:bg-accent/10 disabled:opacity-40"
        >
          Check
        </button>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? "text-forest" : "text-red"}`}>
            {message.message}
          </p>
        )}
      </div>
    </section>
  );
}

function Field({
  field,
  status,
  value,
  shown,
  onChange,
  onToggle,
  onGenerate,
  onRemove,
  disabled,
}: {
  field: ServiceField;
  status?: FieldStatus;
  value: string;
  shown: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  onGenerate: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const saved = status?.set ? `Saved: ${status.preview} — leave empty to keep` : field.placeholder;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={field.key} className="text-sm font-medium">
          {field.label} <code className="text-xs font-normal text-muted">{field.key}</code>
          {field.optional && <span className="ml-1 text-xs font-normal text-muted">optional</span>}
        </label>
        {status?.set && (
          <button type="button" onClick={onRemove} disabled={disabled} className="text-xs text-muted hover:text-red">
            Remove
          </button>
        )}
      </div>

      {field.kind === "json" ? (
        <textarea
          id={field.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder={saved}
          className={`${input} resize-y font-mono text-xs`}
        />
      ) : field.kind === "select" ? (
        <select id={field.key} value={value} onChange={(e) => onChange(e.target.value)} className={input}>
          <option value="">{status?.set ? `Keep: ${status.preview}` : "Choose…"}</option>
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <div className="flex gap-2">
          <input
            id={field.key}
            type={field.kind === "secret" && !shown ? "password" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={saved}
            className={`${input} font-mono`}
          />
          {field.kind === "secret" && (
            <button type="button" onClick={onToggle} className="press shrink-0 rounded-[var(--radius-control)] border border-border px-3 text-xs text-muted hover:text-foreground">
              {shown ? "Hide" : "Show"}
            </button>
          )}
          {field.generate && (
            <button type="button" onClick={onGenerate} className="press shrink-0 rounded-[var(--radius-control)] border border-accent px-3 text-xs font-medium text-accent hover:bg-accent/10">
              Generate
            </button>
          )}
        </div>
      )}
      {field.hint && <p className="text-xs text-muted">{field.hint}</p>}
    </div>
  );
}
