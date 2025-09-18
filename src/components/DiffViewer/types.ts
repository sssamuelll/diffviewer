export type DiffType = 'added' | 'removed' | 'unchanged';

export type DiffViewMode = 'split' | 'unified';

export interface DiffLine {
  type: DiffType;
  leftContent: string;
  rightContent: string;
  leftLineNumber: number | null;
  rightLineNumber: number | null;
}

export interface DiffStats {
  additions: number;
  deletions: number;
}