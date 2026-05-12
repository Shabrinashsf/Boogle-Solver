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
