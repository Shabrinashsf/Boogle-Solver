"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { WordResult } from "@/lib/types";

type LengthFilter = "all" | 3 | 4 | 5 | 6 | 7 | 8;

type ListProps = {
  results: WordResult[];
  activeWord?: string | null;
  onSelectWord: (result: WordResult) => void;
  onHoverWord?: (result: WordResult | null) => void;
};

const lengthFilters: Array<{ label: string; value: LengthFilter }> = [
  { label: "All", value: "all" },
  { label: "8+ letters", value: 8 },
  { label: "7 letters", value: 7 },
  { label: "6 letters", value: 6 },
  { label: "5 letters", value: 5 },
  { label: "4 letters", value: 4 },
  { label: "3 letters", value: 3 },
];

export function List({ results, activeWord, onSelectWord, onHoverWord }: ListProps) {
  const [query, setQuery] = React.useState("");
  const [lengthFilter, setLengthFilter] = React.useState<LengthFilter>("all");

  const filteredResults = React.useMemo(() => {
    const trimmed = query.trim().toUpperCase();

    return results.filter((item) => {
      const lengthMatch =
        lengthFilter === "all"
          ? true
          : lengthFilter === 8
            ? item.word.length >= 8
            : item.word.length === lengthFilter;

      const queryMatch = trimmed ? item.word.includes(trimmed) : true;
      return lengthMatch && queryMatch;
    });
  }, [lengthFilter, query, results]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Found Words</h2>
        <Badge>{results.length} total</Badge>
      </div>
      <div className="mt-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
            search
          </span>
          <Input
            className="pl-10"
            placeholder="Filter words..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 pb-2">
        {lengthFilters.map((filter) => {
          const active = lengthFilter === filter.value;
          return (
            <button
              key={filter.label}
              className={`rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-surface-container-high text-on-surface"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
              }`}
              type="button"
              onClick={() => setLengthFilter(filter.value)}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-2">
        {filteredResults.length === 0 ? (
          <div className="rounded-md border border-dashed border-outline-variant px-4 py-6 text-center text-sm text-on-surface-variant">
            No words yet. Solve the board to see results.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredResults.map((item) => {
              const active = item.word === activeWord;

              return (
                <button
                  key={item.word}
                  className={`flex items-center rounded-md border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-highlight-border bg-highlight"
                      : "border-transparent hover:bg-surface-container-low"
                  }`}
                  type="button"
                  onClick={() => onSelectWord(item)}
                  onMouseEnter={() => onHoverWord?.(item)}
                  onMouseLeave={() => onHoverWord?.(null)}
                >
                  <span className="text-sm font-medium text-on-surface">
                    {item.word}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
