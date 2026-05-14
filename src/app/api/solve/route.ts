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
  algorithm: string;
  results: WordResult[];
  meta: {
    total: number;
    min_length: number;
    execution_time_ms: number;
  };
};

type TargetResponse = {
  mode: "target";
  algorithm: string;
  target: string;
  found: boolean;
  path?: Cell[];
  execution_time_ms: number;
};

type CompareResult = {
  algorithm: string;
  results: WordResult[];
  execution_time_ms: number;
  word_count: number;
};

type CompareResponse = {
  mode: "global";
  comparison: CompareResult[];
  meta: {
    min_length: number;
  };
};

type ErrorResponse = {
  error: string;
};

type AlgorithmType = "trie_dfs" | "hashmap_dfs" | "brute_dfs";

const DIRECTIONS = [
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
];

// ─── Trie + DFS (original) ───────────────────────────────────

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

// ─── HashMap (Set) + DFS ────────────────────────────────────

let globalWordSet: Set<string> | null = null;

async function loadWordSet(): Promise<Set<string>> {
  if (globalWordSet) return globalWordSet;

  const wordSet = new Set<string>();

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "dictionary.txt");
    const text = await fs.readFile(filePath, "utf-8");

    const lines = text.split("\n");
    for (const line of lines) {
      const word = line.trim().toUpperCase();
      if (word.length >= 3 && /^[A-Z]+$/.test(word) && hasVowel(word)) {
        wordSet.add(word);
      }
    }
  } catch (error) {
    console.error("Failed to load dictionary for word set:", error);
    throw new Error("Failed to load dictionary");
  }

  globalWordSet = wordSet;
  return wordSet;
}

// ─── Solver: Trie + DFS ─────────────────────────────────────

function solveTrieDfs(
  board: string[][],
  trie: Trie,
  minLength: number
): WordResult[] {
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

    for (const [dr, dc] of DIRECTIONS) {
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
      const visited = Array.from({ length: rows }, () =>
        Array(cols).fill(false)
      );
      dfs(r, c, visited, "", trie.root, []);
    }
  }

  return Array.from(found.values());
}

// ─── Solver: HashMap (Set) + DFS ─────────────────────────────

function solveHashMapDfs(
  board: string[][],
  wordSet: Set<string>,
  minLength: number
): WordResult[] {
  const rows = board.length;
  const cols = board[0].length;
  const found = new Map<string, WordResult>();
  let maxLength = 0;
  for (const w of wordSet) {
    if (w.length > maxLength) maxLength = w.length;
  }

  function dfs(
    r: number,
    c: number,
    visited: boolean[][],
    current: string,
    path: Cell[]
  ) {
    const letter = board[r][c].toUpperCase();
    const newWord = current + letter;

    if (newWord.length > maxLength) {
      return;
    }

    visited[r][c] = true;
    const newPath = [...path, { r, c }];

    if (newWord.length >= minLength && wordSet.has(newWord)) {
      if (!found.has(newWord)) {
        found.set(newWord, {
          word: newWord,
          length: newWord.length,
          path: newPath,
        });
      }
    }

    for (const [dr, dc] of DIRECTIONS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        dfs(nr, nc, visited, newWord, newPath);
      }
    }

    visited[r][c] = false;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const visited = Array.from({ length: rows }, () =>
        Array(cols).fill(false)
      );
      dfs(r, c, visited, "", []);
    }
  }

  return Array.from(found.values());
}

// ─── Solver: Brute Force DFS (no pruning) ───────────────────

let globalDictionaryWords: string[] | null = null;

async function loadDictionaryWords(): Promise<string[]> {
  if (globalDictionaryWords) return globalDictionaryWords;

  const words: string[] = [];

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "dictionary.txt");
    const text = await fs.readFile(filePath, "utf-8");

    const lines = text.split("\n");
    for (const line of lines) {
      const word = line.trim().toUpperCase();
      if (word.length >= 3 && /^[A-Z]+$/.test(word) && hasVowel(word)) {
        words.push(word);
      }
    }
  } catch (error) {
    console.error("Failed to load dictionary for brute force:", error);
    throw new Error("Failed to load dictionary");
  }

  globalDictionaryWords = words;
  return words;
}

function solveBruteDfs(
  board: string[][],
  dictionaryWords: string[],
  minLength: number
): WordResult[] {
  const rows = board.length;
  const cols = board[0].length;
  let maxWordLen = minLength;
  for (const w of dictionaryWords) {
    if (w.length > maxWordLen) maxWordLen = w.length;
  }
  const wordSet = new Set(dictionaryWords.filter((w) => w.length >= minLength));
  const found = new Map<string, WordResult>();

  function dfs(
    r: number,
    c: number,
    visited: boolean[][],
    current: string,
    path: Cell[]
  ) {
    const letter = board[r][c].toUpperCase();
    const newWord = current + letter;

    if (newWord.length > maxWordLen) {
      return;
    }

    visited[r][c] = true;
    const newPath = [...path, { r, c }];

    if (newWord.length >= minLength && wordSet.has(newWord)) {
      if (!found.has(newWord)) {
        found.set(newWord, {
          word: newWord,
          length: newWord.length,
          path: newPath,
        });
      }
    }

    for (const [dr, dc] of DIRECTIONS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        dfs(nr, nc, visited, newWord, newPath);
      }
    }

    visited[r][c] = false;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const visited = Array.from({ length: rows }, () =>
        Array(cols).fill(false)
      );
      dfs(r, c, visited, "", []);
    }
  }

  return Array.from(found.values());
}

// ─── Target solvers ──────────────────────────────────────────

function solveTargetTrieDfs(
  board: string[][],
  target: string
): Cell[] | null {
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

    for (const [dr, dc] of DIRECTIONS) {
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
      const visited = Array.from({ length: rows }, () =>
        Array(cols).fill(false)
      );
      const result = dfs(r, c, visited, 0, []);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

function solveTargetHashMapDfs(
  board: string[][],
  target: string
): Cell[] | null {
  return solveTargetTrieDfs(board, target);
}

function solveTargetBruteDfs(
  board: string[][],
  target: string
): Cell[] | null {
  return solveTargetTrieDfs(board, target);
}

// ─── API Route ───────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<
  NextResponse<
    GlobalResponse | TargetResponse | CompareResponse | ErrorResponse
  >
> {
  try {
    const body = await request.json();
    const { board, mode, target, min_length, algorithm } = body;

    // Validate board
    if (!Array.isArray(board) || board.length < 3 || board.length > 8) {
      return NextResponse.json(
        { error: "board must have between 3 and 8 rows" },
        { status: 400 }
      );
    }

    const cols = board[0]?.length;

    if (cols < 3 || cols > 8) {
      return NextResponse.json(
        { error: "board must have between 3 and 8 columns" },
        { status: 400 }
      );
    }

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

    const algorithmType: AlgorithmType =
      algorithm === "hashmap_dfs" || algorithm === "brute_dfs"
        ? algorithm
        : "trie_dfs";

    // Compare mode: run all three algorithms
    if (algorithm === "compare_all" && mode === "global") {
      const minLen = min_length || 3;
      if (minLen < 3) {
        return NextResponse.json(
          { error: "min_length must be at least 3" },
          { status: 400 }
        );
      }

      const [trie, wordSet, dictWords] = await Promise.all([
        loadTrie(),
        loadWordSet(),
        loadDictionaryWords(),
      ]);

      const comparison: CompareResult[] = [];

      // Trie + DFS
      const t0 = performance.now();
      const trieResults = solveTrieDfs(normalizedBoard, trie, minLen);
      const t1 = performance.now();
      comparison.push({
        algorithm: "Trie + DFS",
        results: trieResults,
        execution_time_ms: Math.round((t1 - t0) * 1000) / 1000,
        word_count: trieResults.length,
      });

      // HashMap + DFS
      const t2 = performance.now();
      const hashMapResults = solveHashMapDfs(normalizedBoard, wordSet, minLen);
      const t3 = performance.now();
      comparison.push({
        algorithm: "HashMap + DFS",
        results: hashMapResults,
        execution_time_ms: Math.round((t3 - t2) * 1000) / 1000,
        word_count: hashMapResults.length,
      });

      // Brute Force + DFS
      const t4 = performance.now();
      const bruteResults = solveBruteDfs(normalizedBoard, dictWords, minLen);
      const t5 = performance.now();
      comparison.push({
        algorithm: "Brute Force + DFS",
        results: bruteResults,
        execution_time_ms: Math.round((t5 - t4) * 1000) / 1000,
        word_count: bruteResults.length,
      });

      return NextResponse.json({
        mode: "global",
        comparison,
        meta: {
          min_length: minLen,
        },
      });
    }

    // Single algorithm mode
    if (mode === "global") {
      const minLen = min_length || 3;
      if (minLen < 3) {
        return NextResponse.json(
          { error: "min_length must be at least 3" },
          { status: 400 }
        );
      }

      let results: WordResult[];
      let algoLabel: string;
      const start = performance.now();

      if (algorithmType === "hashmap_dfs") {
        const wordSet = await loadWordSet();
        results = solveHashMapDfs(normalizedBoard, wordSet, minLen);
        algoLabel = "HashMap + DFS";
      } else if (algorithmType === "brute_dfs") {
        const dictWords = await loadDictionaryWords();
        results = solveBruteDfs(normalizedBoard, dictWords, minLen);
        algoLabel = "Brute Force + DFS";
      } else {
        const trie = await loadTrie();
        results = solveTrieDfs(normalizedBoard, trie, minLen);
        algoLabel = "Trie + DFS";
      }

      const elapsed = performance.now() - start;

      return NextResponse.json({
        mode: "global",
        algorithm: algoLabel,
        results,
        meta: {
          total: results.length,
          min_length: minLen,
          execution_time_ms: Math.round(elapsed * 1000) / 1000,
        },
      });
    } else {
      // Target mode
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

      const start = performance.now();

      const { path, algoLabel } =
        algorithmType === "hashmap_dfs"
          ? {
              path: solveTargetHashMapDfs(normalizedBoard, targetUpper),
              algoLabel: "HashMap + DFS (Target)",
            }
          : algorithmType === "brute_dfs"
          ? {
              path: solveTargetBruteDfs(normalizedBoard, targetUpper),
              algoLabel: "Brute Force + DFS (Target)",
            }
          : {
              path: solveTargetTrieDfs(normalizedBoard, targetUpper),
              algoLabel: "Trie + DFS (Target)",
            };

      const elapsed = performance.now() - start;

      return NextResponse.json({
        mode: "target",
        algorithm: algoLabel,
        target: targetUpper,
        found: path !== null,
        path: path || undefined,
        execution_time_ms: Math.round(elapsed * 1000) / 1000,
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