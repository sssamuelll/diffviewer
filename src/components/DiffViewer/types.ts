export type DiffLineType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface DiffLine {
  lineNumber: number | null;
  content: string;
  type: DiffLineType;
}

export interface HighlightedDiffLine extends DiffLine {
  highlightedContent: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  modifications: number;
}
