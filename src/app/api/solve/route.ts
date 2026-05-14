import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type Cell = {
  r: number;
  c: number;
};

type WordResult = {
  word: string;
  length: number;
  path: Cell[];
};

type GlobalResponse = {
  mode: "global";
  results: WordResult[];
  meta: {
    total: number;
    min_length: number;
  };
};

type TargetResponse = {
  mode: "target";
  target: string;
  found: boolean;
  path?: Cell[];
};

type ErrorResponse = {
  error: string;
};

// Trie implementation
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd: boolean = false;
}

class Trie {
  root: TrieNode = new TrieNode();

  insert(word: string) {
    let node = this.root;
    for (const ch of word) {
      const idx = ch.toUpperCase();
      if (!node.children.has(idx)) {
        node.children.set(idx, new TrieNode());
      }
      node = node.children.get(idx)!;
    }
    node.isEnd = true;
  }

  searchPrefix(prefix: string): TrieNode | null {
    let node = this.root;
    for (const ch of prefix) {
      const idx = ch.toUpperCase();
      if (!node.children.has(idx)) {
        return null;
      }
      node = node.children.get(idx)!;
    }
    return node;
  }

  isWord(word: string): boolean {
    const node = this.searchPrefix(word);
    return node !== null && node.isEnd;
  }

  hasPrefix(prefix: string): boolean {
    return this.searchPrefix(prefix) !== null;
  }
}

let globalTrie: Trie | null = null;

async function loadTrie(): Promise<Trie> {
  if (globalTrie) return globalTrie;

  const trie = new Trie();

  try {
    
    const fs = await import("fs/promises");
    const path = await import("path");
    
    const filePath = path.join(process.cwd(), "public", "dictionary.txt");
    const text = await fs.readFile(filePath, "utf-8");

    const lines = text.split("\n");
    for (const line of lines) {
      const word = line.trim().toUpperCase();
      if (word.length >= 3 && /^[A-Z]+$/.test(word) && hasVowel(word)) {
        trie.insert(word);
      }
    }
  } catch (error) {
    console.error("Failed to load dictionary:", error);
    throw new Error("Failed to load dictionary");
  }

  globalTrie = trie;
  return trie;
}

function hasVowel(word: string): boolean {
  return /[AEIOUY]/.test(word);
}

const directions = [
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
];

function solveGlobal(board: string[][], trie: Trie, minLength: number): WordResult[] {
  const rows = board.length;
  const cols = board[0].length;
  const found = new Map<string, WordResult>();

  function dfs(
    r: number,
    c: number,
    visited: boolean[][],
    current: string,
    node: TrieNode,
    path: Cell[]
  ) {
    const letter = board[r][c];
    const idx = letter.toUpperCase();

    if (!node.children.has(idx)) {
      return;
    }

    const nextNode = node.children.get(idx)!;
    const newWord = current + letter;

    visited[r][c] = true;
    const newPath = [...path, { r, c }];

    if (nextNode.isEnd && newWord.length >= minLength) {
      if (!found.has(newWord)) {
        found.set(newWord, {
          word: newWord,
          length: newWord.length,
          path: newPath,
        });
      }
    }

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        dfs(nr, nc, visited, newWord, nextNode, newPath);
      }
    }

    visited[r][c] = false;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
      dfs(r, c, visited, "", trie.root, []);
    }
  }

  return Array.from(found.values());
}

function solveTarget(board: string[][], target: string): Cell[] | null {
  const rows = board.length;
  const cols = board[0].length;
  const targetUpper = target.toUpperCase();

  function dfs(
    r: number,
    c: number,
    visited: boolean[][],
    index: number,
    path: Cell[]
  ): Cell[] | null {
    if (board[r][c].toUpperCase() !== targetUpper[index]) {
      return null;
    }

    visited[r][c] = true;
    const newPath = [...path, { r, c }];

    if (index === targetUpper.length - 1) {
      return newPath;
    }

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        const result = dfs(nr, nc, visited, index + 1, newPath);
        if (result) {
          return result;
        }
      }
    }

    visited[r][c] = false;
    return null;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
      const result = dfs(r, c, visited, 0, []);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<GlobalResponse | TargetResponse | ErrorResponse>> {
  try {
    const body = await request.json();
    const { board, mode, target, min_length } = body;

    // Validate board
    if (!Array.isArray(board) || board.length < 3 || board.length > 8) {
      return NextResponse.json(
        { error: "board must have between 3 and 8 rows" },
        { status: 400 }
      );
    }

    const rows = board.length;
    const cols = board[0]?.length;

    if (cols < 3 || cols > 8) {
      return NextResponse.json(
        { error: "board must have between 3 and 8 columns" },
        { status: 400 }
      );
    }

    // Normalize board
    const normalizedBoard = board.map((row: string[]) =>
      row.map((cell: string) => (typeof cell === "string" ? cell.toUpperCase() : ""))
    );

    // Validate mode
    if (mode !== "global" && mode !== "target") {
      return NextResponse.json(
        { error: "mode must be 'global' or 'target'" },
        { status: 400 }
      );
    }

    // Load trie
    const trie = await loadTrie();

    if (mode === "global") {
      const minLen = min_length || 3;
      if (minLen < 3) {
        return NextResponse.json(
          { error: "min_length must be at least 3" },
          { status: 400 }
        );
      }

      const results = solveGlobal(normalizedBoard, trie, minLen);

      return NextResponse.json({
        mode: "global",
        results,
        meta: {
          total: results.length,
          min_length: minLen,
        },
      });
    } else {
      if (!target || typeof target !== "string") {
        return NextResponse.json(
          { error: "target word is required for target mode" },
          { status: 400 }
        );
      }

      const targetUpper = target.trim().toUpperCase();
      if (targetUpper.length < 3) {
        return NextResponse.json(
          { error: "target word must be at least 3 letters" },
          { status: 400 }
        );
      }

      const path = solveTarget(normalizedBoard, targetUpper);

      return NextResponse.json({
        mode: "target",
        target: targetUpper,
        found: path !== null,
        path: path || undefined,
      });
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
