export type LanguageOption =
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'css'
  | 'json'
  | 'plaintext';

export type DiffSegmentType = 'equal' | 'insert' | 'delete' | 'modify';

export interface DiffSegment {
  value: string;
  type: DiffSegmentType;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  modifications: number;
}
