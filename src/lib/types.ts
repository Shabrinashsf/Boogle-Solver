export type BoardCell = {
  letter: string;
  highlighted?: boolean;
};

export type WordPathNode = {
  row: number;
  col: number;
};

export type WordResult = {
  word: string;
  points: number;
  path: WordPathNode[] | undefined;
};

export type AlgorithmType = "trie_dfs" | "hashmap_dfs" | "brute_dfs" | "compare_all";

export type AlgorithmOption = {
  value: AlgorithmType;
  label: string;
  description: string;
};

export type ComparisonResult = {
  algorithm: string;
  execution_time_ms: number;
  word_count: number;
};
