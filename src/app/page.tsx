"use client";

import * as React from "react";

import { Board } from "@/components/boggle/Board";
import { List } from "@/components/boggle/List";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { WordPathNode, WordResult } from "@/lib/types";

type SolverMode = "global" | "target";

const sizeOptions = [
  { label: "3x3 (Mini)", value: 3 },
  { label: "4x4 (Classic)", value: 4 },
  { label: "5x5 (Big Boggle)", value: 5 },
  { label: "6x6 (Super Big)", value: 6 },
  { label: "7x7", value: 7 },
  { label: "8x8", value: 8 },
];

const createEmptyBoard = (size: number) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => ""));

const resizeBoard = (board: string[][], size: number) => {
  const nextBoard = createEmptyBoard(size);
  const copySize = Math.min(board.length, size);

  for (let row = 0; row < copySize; row += 1) {
    for (let col = 0; col < copySize; col += 1) {
      nextBoard[row][col] = board[row][col];
    }
  }

  return nextBoard;
};

const randomLetter = () =>
  String.fromCharCode(65 + Math.floor(Math.random() * 26));

const createRandomBoard = (size: number) =>
  Array.from({ length: size }, () =>
    Array.from({ length: size }, () => randomLetter())
  );

const buildHighlightSet = (path?: WordPathNode[]) => {
  const result = new Set<string>();
  if (!path) {
    return result;
  }

  path.forEach((node) => {
    result.add(`${node.row}-${node.col}`);
  });

  return result;
};

const scoreWord = (word: string) => Math.max(1, word.length - 2);

const normalizePath = (path: unknown): WordPathNode[] | undefined => {
  if (!Array.isArray(path)) {
    return undefined;
  }

  const nodes = path
    .map((node) => {
      if (Array.isArray(node) && node.length >= 2) {
        return { row: Number(node[0]), col: Number(node[1]) };
      }

      if (node && typeof node === "object") {
        const record = node as Record<string, unknown>;
        const row =
          typeof record.row === "number"
            ? record.row
            : typeof record.r === "number"
            ? record.r
            : typeof record.row === "string"
            ? Number(record.row)
            : typeof record.r === "string"
            ? Number(record.r)
            : NaN;
        const col =
          typeof record.col === "number"
            ? record.col
            : typeof record.c === "number"
            ? record.c
            : typeof record.col === "string"
            ? Number(record.col)
            : typeof record.c === "string"
            ? Number(record.c)
            : NaN;

        if (Number.isFinite(row) && Number.isFinite(col)) {
          return { row, col };
        }
      }

      return null;
    })
    .filter(
      (node): node is WordPathNode =>
        !!node && Number.isFinite(node.row) && Number.isFinite(node.col)
    );

  return nodes.length ? nodes : undefined;
};

const normalizeResults = (data: unknown): WordResult[] => {
  if (!data) {
    return [];
  }

  const rawArray = Array.isArray(data)
    ? data
    : Array.isArray((data as { words?: unknown }).words)
      ? (data as { words: unknown[] }).words
      : Array.isArray((data as { results?: unknown }).results)
        ? (data as { results: unknown[] }).results
        : [];

  const results = rawArray
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as {
        word?: string;
        text?: string;
        points?: number;
        score?: number;
        path?: unknown;
        cells?: unknown;
        coords?: unknown;
      };

      const word = (record.word ?? record.text ?? "").toUpperCase();
      if (!word) {
        return null;
      }

      return {
        word,
        points: Number(record.points ?? record.score ?? scoreWord(word)),
        path: normalizePath(record.path ?? record.cells ?? record.coords),
      };
    })
    .filter((item): item is WordResult => !!item);

  const unique = new Map<string, WordResult>();
  results.forEach((item) => {
    if (!unique.has(item.word)) {
      unique.set(item.word, item);
    }
  });

  return Array.from(unique.values());
};

const buildFallbackResults = (board: string[][], minLength: number) => {
  const results: WordResult[] = [];

  board.forEach((row, rowIndex) => {
    const letters = row
      .map((letter, colIndex) => ({ letter, colIndex }))
      .filter(({ letter }) => letter);

    if (letters.length >= minLength) {
      const word = letters.map(({ letter }) => letter).join("");
      results.push({
        word,
        points: scoreWord(word),
        path: letters.map(({ colIndex }) => ({ row: rowIndex, col: colIndex })),
      });
    }
  });

  const size = board.length;
  for (let col = 0; col < size; col += 1) {
    const letters = board
      .map((row, rowIndex) => ({ letter: row[col], rowIndex }))
      .filter(({ letter }) => letter);

    if (letters.length >= minLength) {
      const word = letters.map(({ letter }) => letter).join("");
      results.push({
        word,
        points: scoreWord(word),
        path: letters.map(({ rowIndex }) => ({ row: rowIndex, col })),
      });
    }
  }

  const unique = new Map<string, WordResult>();
  results.forEach((item) => {
    if (!unique.has(item.word)) {
      unique.set(item.word, item);
    }
  });

  return Array.from(unique.values());
};

export default function Home() {
  const [mode, setMode] = React.useState<SolverMode>("global");
  const [boardSize, setBoardSize] = React.useState(4);
  const [board, setBoard] = React.useState(() => createEmptyBoard(4));
  const [minLength, setMinLength] = React.useState(3);
  const [targetWord, setTargetWord] = React.useState("");
  const [results, setResults] = React.useState<WordResult[]>([]);
  const [activeWord, setActiveWord] = React.useState<string | null>(null);
  const [hoveredWord, setHoveredWord] = React.useState<WordResult | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [isSolving, setIsSolving] = React.useState(false);
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [targetInputError, setTargetInputError] = React.useState<string | null>(
    null
  );
  const [invalidCells, setInvalidCells] = React.useState<Set<string>>(
    () => new Set()
  );

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const initialTheme =
      storedTheme === "dark" || (!storedTheme && prefersDark)
        ? "dark"
        : "light";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const selectedResult = React.useMemo(
    () => results.find((item) => item.word === activeWord) ?? null,
    [activeWord, results]
  );

  const highlightedCells = React.useMemo(
    () => buildHighlightSet(hoveredWord?.path ?? selectedResult?.path),
    [hoveredWord, selectedResult]
  );

  React.useEffect(() => {
    if (activeWord && !results.some((item) => item.word === activeWord)) {
      setActiveWord(null);
    }
  }, [activeWord, results]);

  React.useEffect(() => {
    if (mode !== "target") {
      setTargetInputError(null);
    }
  }, [mode]);

  const handleBoardChange = (row: number, col: number, value: string) => {
    setBoard((prev) => {
      const next = prev.map((rowCells) => [...rowCells]);
      next[row][col] = value;
      return next;
    });
    setHoveredWord(null);
  };

  const handleInvalidInput = (
    row: number,
    col: number,
    isInvalid: boolean
  ) => {
    const key = `${row}-${col}`;
    setInvalidCells((prev) => {
      const next = new Set(prev);
      if (isInvalid) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleClearBoard = () => {
    setBoard(createEmptyBoard(boardSize));
    setResults([]);
    setActiveWord(null);
    setHoveredWord(null);
    setInvalidCells(new Set());
  };

  const handleRandomFill = () => {
    setBoard(createRandomBoard(boardSize));
    setResults([]);
    setActiveWord(null);
    setHoveredWord(null);
    setInvalidCells(new Set());
  };

  const handleSizeChange = (value: number) => {
    setBoardSize(value);
    setBoard((prev) => resizeBoard(prev, value));
    setResults([]);
    setActiveWord(null);
    setHoveredWord(null);
    setInvalidCells(new Set());
  };

  const handleSolve = async () => {
    setIsSolving(true);
    setHoveredWord(null);
    setActiveWord(null);

    try {
      const payload: Record<string, unknown> = {
        board,
        mode,
      };

      if (mode === "global") {
        payload.min_length = minLength;
      }

      if (mode === "target") {
        payload.target = targetWord.trim().toUpperCase();
      }

      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Solver response not available");
      }

      const data = (await response.json()) as unknown;

      if (mode === "target") {
        const targetUpper = targetWord.trim().toUpperCase();
        const found = Boolean(
          data && typeof data === "object" && (data as Record<string, unknown>).found
        );
        const path = normalizePath(
          data && typeof data === "object"
            ? (data as Record<string, unknown>).path
            : undefined
        );

        setResults(
          found && targetUpper
            ? [
                {
                  word: targetUpper,
                  points: scoreWord(targetUpper),
                  path,
                },
              ]
            : []
        );
      } else {
        setResults(normalizeResults(data));
      }
    } catch (error) {
      setResults(buildFallbackResults(board, minLength));
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-surface-variant bg-surface px-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-semibold text-primary">Boggle Pro</span>
          <button className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high md:hidden">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
            type="button"
            onClick={() => setHelpOpen(true)}
          >
            <span className="material-symbols-outlined">help_outline</span>
          </button>
          <button
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className="material-symbols-outlined">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1360px] min-h-[calc(100vh-4rem)] grid-cols-1 gap-6 px-6 py-8 md:grid-cols-12">
        <aside className="md:col-span-3 flex flex-col gap-6 md:h-[calc(100vh-7rem)]">
          <Card className="animate-fade-up" style={{ animationDelay: "80ms" }}>
            <CardHeader>
              <CardTitle>Solver Mode</CardTitle>
            </CardHeader>
            <CardContent className="mt-0 space-y-6">
              <div className="flex rounded-lg bg-surface-container-low p-1">
                <button
                  className={`flex-1 rounded-md py-2 text-sm font-medium shadow-sm transition-colors ${
                    mode === "global"
                      ? "bg-surface-container-lowest text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                  type="button"
                  onClick={() => setMode("global")}
                >
                  Global
                </button>
                <button
                  className={`flex-1 rounded-md py-2 text-sm font-medium shadow-sm transition-colors ${
                    mode === "target"
                      ? "bg-surface-container-lowest text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                  type="button"
                  onClick={() => setMode("target")}
                >
                  Target Word
                </button>
              </div>
              {mode === "target" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-on-surface-variant">
                    Target Word
                  </label>
                  <Input
                    placeholder="Type the word to find"
                    value={targetWord}
                    onChange={(event) => {
                      const rawValue = event.target.value;
                      const sanitized = rawValue.replace(/[^a-zA-Z]/g, "");
                      const normalized = sanitized.toUpperCase();
                      const truncated = normalized.slice(0, 8);
                      setTargetWord(truncated);

                      if (!rawValue) {
                        setTargetInputError(null);
                        return;
                      }

                      if (sanitized.length !== rawValue.length) {
                        setTargetInputError("Only letters A-Z are allowed.");
                        return;
                      }

                      if (normalized.length > 8) {
                        setTargetInputError("Maximum length is 8 letters.");
                        return;
                      }

                      if (truncated.length < 3) {
                        setTargetInputError("Minimum length is 3 letters.");
                        return;
                      }

                      setTargetInputError(null);
                    }}
                  />
                  {targetInputError && (
                    <p className="text-xs font-medium text-red-600">
                      {targetInputError}
                    </p>
                  )}
                  {!targetInputError && (
                    <p className="text-xs text-on-surface-variant">
                      Use 3-8 letters (A-Z).
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-medium text-on-surface-variant">
                  Grid Size
                </label>
                <select
                  className="w-full rounded-md border border-outline-variant bg-surface-bright px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  value={boardSize}
                  onChange={(event) =>
                    handleSizeChange(Number(event.target.value))
                  }
                >
                  {sizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {mode === "global" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-on-surface-variant">
                    Minimum Word Length
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      className="flex-1 accent-primary"
                      max={8}
                      min={3}
                      type="range"
                      value={minLength}
                      onChange={(event) =>
                        setMinLength(Number(event.target.value))
                      }
                    />
                    <span className="w-6 text-center text-sm font-medium text-on-surface">
                      {minLength}
                    </span>
                  </div>
                </div>
              )}
              <Button
                className="w-full"
                variant="default"
                disabled={
                  isSolving ||
                  (mode === "target" &&
                    (targetWord.trim().length < 3 ||
                      targetWord.trim().length > 8 ||
                      !!targetInputError))
                }
                onClick={handleSolve}
              >
                <span className="material-symbols-outlined text-[18px]">search</span>
                {isSolving ? "Solving..." : "Solve Board"}
              </Button>
            </CardContent>
          </Card>

          <Card
            className="flex-1 animate-fade-up"
            style={{ animationDelay: "160ms" }}
          >
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="mt-0 space-y-2">
              <button
                className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low"
                type="button"
                onClick={handleClearBoard}
              >
                <span className="material-symbols-outlined text-[18px]">clear_all</span>
                Clear Board
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low"
                type="button"
                onClick={handleRandomFill}
              >
                <span className="material-symbols-outlined text-[18px]">shuffle</span>
                Random Fill
              </button>
            </CardContent>
          </Card>
        </aside>

        <section className="md:col-span-6 flex flex-col gap-6 md:h-[calc(100vh-7rem)]">
          <Card
            className="flex-1 animate-fade-up overflow-hidden"
            style={{ animationDelay: "240ms" }}
          >
            <CardContent className="mt-0 flex h-full flex-col items-center justify-center gap-6">
              {invalidCells.size > 0 && (
                <div className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Only letters A-Z are allowed. Please replace any invalid
                  characters.
                </div>
              )}
              <Board
                board={board}
                highlightedCells={highlightedCells}
                invalidCells={invalidCells}
                size={boardSize}
                onCellChange={handleBoardChange}
                onInvalidInput={handleInvalidInput}
              />
              <div className="text-center">
                <p className="text-sm text-on-surface-variant">
                  Select a word in the right panel to see its path.
                </p>
                {selectedResult ? (
                  <div className="mt-4 inline-flex items-center rounded-full border border-highlight-border/40 bg-highlight/40 px-4 py-2">
                    <span className="text-lg font-semibold tracking-wide text-primary">
                      {selectedResult.word}
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-on-surface-variant">
                    No word selected
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="md:col-span-3 flex flex-col gap-6 md:h-[calc(100vh-7rem)]">
          <Card
            className="flex h-full min-h-0 flex-col animate-fade-up overflow-hidden"
            style={{ animationDelay: "320ms" }}
          >
            <CardContent className="mt-0 flex h-full min-h-0 flex-col">
              <List
                results={results}
                activeWord={activeWord}
                onSelectWord={(item) => {
                  setActiveWord(item.word);
                  setHoveredWord(null);
                }}
                onHoverWord={setHoveredWord}
              />
            </CardContent>
          </Card>
        </aside>
      </main>

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
          <Card className="w-full max-w-lg border border-outline-variant bg-surface shadow-ambient">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>About Boggle Pro Solver</CardTitle>
              <button
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low"
                type="button"
                onClick={() => setHelpOpen(false)}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-on-surface-variant">
              <p>
                Boggle Pro is a high-performance solver built with Next.js and a
                Go engine. You can design custom boards, switch grid sizes, and
                solve in two modes: Global Discovery or Target Word.
              </p>
              <p>
                Click any found word to visualize its path on the board. Use
                Clear Board or Random Fill to reset the grid quickly.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
