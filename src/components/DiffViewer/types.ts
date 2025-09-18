export type DiffTokenType = 'context' | 'addition' | 'deletion';

export type DiffLineType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface DiffToken {
  value: string;
  type: DiffTokenType;
}

export interface DiffPaneLine {
  id: string;
  lineNumber: number;
  text: string;
  type: DiffLineType;
  tokens: DiffToken[];
}

export interface InlineDiffResult {
  left: DiffPaneLine[];
  right: DiffPaneLine[];
  stats: DiffStats;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  modifications: number;
}