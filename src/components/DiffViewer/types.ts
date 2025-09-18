export type DiffLineType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface PaneDiffLine {
  type: DiffLineType;
  content: string;
  lineNumber: number;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  modifications: number;
}

export interface DiffComputation {
  original: PaneDiffLine[];
  modified: PaneDiffLine[];
  stats: DiffStats;
}