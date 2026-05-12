"use client";

import * as React from "react";

type BoardProps = {
  board: string[][];
  size: number;
  highlightedCells?: Set<string>;
  onCellChange: (row: number, col: number, value: string) => void;
};

const cellSizeMap: Record<number, string> = {
  3: "h-16 w-16 text-3xl",
  4: "h-16 w-16 text-3xl",
  5: "h-14 w-14 text-2xl",
  6: "h-12 w-12 text-2xl",
  7: "h-12 w-12 text-xl",
  8: "h-11 w-11 text-lg",
};

export function Board({ board, size, highlightedCells, onCellChange }: BoardProps) {
  const totalCells = size * size;
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  React.useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, totalCells);
  }, [totalCells]);

  const focusCell = (index: number) => {
    const target = inputRefs.current[index];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const handleChange = (
    rowIndex: number,
    colIndex: number,
    rawValue: string
  ) => {
    const nextValue = rawValue.replace(/[^a-zA-Z]/g, "").slice(0, 1);
    const normalized = nextValue.toUpperCase();
    onCellChange(rowIndex, colIndex, normalized);

    if (normalized) {
      const nextIndex = rowIndex * size + colIndex + 1;
      if (nextIndex < totalCells) {
        focusCell(nextIndex);
      }
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const currentIndex = rowIndex * size + colIndex;

    if (event.key === "Backspace" && !board[rowIndex][colIndex]) {
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        focusCell(prevIndex);
      }
    }

    if (event.key === "ArrowRight") {
      const nextIndex = currentIndex + 1;
      if (nextIndex < totalCells) {
        focusCell(nextIndex);
      }
    }

    if (event.key === "ArrowLeft") {
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        focusCell(prevIndex);
      }
    }

    if (event.key === "ArrowDown") {
      const nextIndex = currentIndex + size;
      if (nextIndex < totalCells) {
        focusCell(nextIndex);
      }
    }

    if (event.key === "ArrowUp") {
      const prevIndex = currentIndex - size;
      if (prevIndex >= 0) {
        focusCell(prevIndex);
      }
    }
  };

  const cellSize = cellSizeMap[size] ?? cellSizeMap[4];

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {board.map((row, rowIndex) =>
          row.map((letter, colIndex) => {
            const key = `${rowIndex}-${colIndex}`;
            const highlighted = highlightedCells?.has(key);

            return (
              <div
                key={key}
                className={`flex items-center justify-center rounded-lg border shadow-sm transition-colors ${
                  highlighted
                    ? "bg-highlight border-highlight-border"
                    : "bg-surface-container-lowest border-outline-variant"
                }`}
              >
                <input
                  ref={(node) => {
                    inputRefs.current[rowIndex * size + colIndex] = node;
                  }}
                  aria-label={`Cell ${rowIndex + 1}-${colIndex + 1}`}
                  className={`${cellSize} bg-transparent text-center font-semibold uppercase text-on-surface outline-none`}
                  inputMode="text"
                  maxLength={1}
                  spellCheck={false}
                  value={letter}
                  onChange={(event) =>
                    handleChange(rowIndex, colIndex, event.target.value)
                  }
                  onKeyDown={(event) =>
                    handleKeyDown(event, rowIndex, colIndex)
                  }
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
