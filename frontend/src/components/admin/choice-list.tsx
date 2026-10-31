"use client";

import { useId, useState } from "react";

import { Checkbox, inputClass } from "@/components/ui/field";

export type Choice = { id: string; name: string; hint?: string; disabled?: boolean };

/**
 * A searchable list of checkboxes for picking products or product types.
 * Selected items stay listed even when the search hides other entries.
 */
export function ChoiceList({
  legend,
  choices,
  selected,
  onChange,
  emptyText,
  error,
  hint,
}: {
  legend: string;
  choices: Choice[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyText: string;
  error?: string;
  hint?: string;
}) {
  const uid = useId();
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? choices.filter((c) => selected.includes(c.id) || c.name.toLowerCase().includes(needle))
    : choices;

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selected, id] : selected.filter((s) => s !== id));
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-800">
        {legend}
        {selected.length > 0 && (
          <span className="ml-2 text-xs font-normal text-zinc-500">{selected.length} selected</span>
        )}
      </legend>
      {choices.length > 8 && (
        <input
          type="search"
          aria-label={`Search ${legend.toLowerCase()}`}
          placeholder="Search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`mt-2 ${inputClass()}`}
        />
      )}
      <div
        className={`mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2 ${
          error ? "border-red-300" : "border-zinc-200"
        }`}
      >
        {choices.length === 0 && <p className="text-sm text-zinc-500">{emptyText}</p>}
        {choices.length > 0 && visible.length === 0 && (
          <p className="text-sm text-zinc-500">Nothing matches “{filter}”.</p>
        )}
        {visible.map((choice) => (
          <Checkbox
            key={choice.id}
            id={`${uid}-${choice.id}`}
            label={choice.name}
            hint={choice.hint}
            disabled={choice.disabled && !selected.includes(choice.id)}
            checked={selected.includes(choice.id)}
            onChange={(checked) => toggle(choice.id, checked)}
          />
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </fieldset>
  );
}
