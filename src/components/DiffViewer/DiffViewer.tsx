import { type FC, useCallback, useMemo, useState } from 'react';
import * as Diff from 'diff';
import Prism from 'prismjs';
import '../../styles/prism-vsc-dark-plus.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import './DiffViewer.css';
import DiffEditorPane from './DiffEditorPane';
import { type DiffLine, type DiffStats, type HighlightedDiffLine } from './types';

interface DiffComputationResult {
  readonly original: DiffLine[];
  readonly modified: DiffLine[];
  readonly stats: DiffStats;
}

const splitIntoLines = (value: string): string[] => {
  if (!value) {
    return [];
  }

  const normalized = value.replace(/\r\n/g, '\n');
  const segments = normalized.split('\n');
  if (segments.length > 1 && segments[segments.length - 1] === '') {
    segments.pop();
  }
  return segments;
};

const computeDiff = (original: string, modified: string): DiffComputationResult => {
  if (!original && !modified) {
    return {
      original: [],
      modified: [],
      stats: { additions: 0, deletions: 0, modifications: 0 },
    };
  }

  const parts = Diff.diffLines(original, modified);
  const originalLines: DiffLine[] = [];
  const modifiedLines: DiffLine[] = [];
  let originalLineNumber = 1;
  let modifiedLineNumber = 1;
  let additions = 0;
  let deletions = 0;
  let modifications = 0;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (part.removed && index + 1 < parts.length && parts[index + 1]?.added) {
      const nextPart = parts[index + 1];
      const removedLines = splitIntoLines(part.value);
      const addedLines = splitIntoLines(nextPart.value);

      removedLines.forEach((line) => {
        originalLines.push({ content: line, type: 'modified', lineNumber: originalLineNumber });
        originalLineNumber += 1;
      });

      addedLines.forEach((line) => {
        modifiedLines.push({ content: line, type: 'modified', lineNumber: modifiedLineNumber });
        modifiedLineNumber += 1;
      });

      modifications += Math.max(removedLines.length, addedLines.length, 1);
      index += 1;
      continue;
    }

    if (part.added) {
      const addedLines = splitIntoLines(part.value);
      if (addedLines.length === 0) {
        modifiedLines.push({ content: '', type: 'added', lineNumber: modifiedLineNumber });
        originalLines.push({ content: '', type: 'added', lineNumber: null });
        additions += 1;
        modifiedLineNumber += 1;
      } else {
        addedLines.forEach((line) => {
          modifiedLines.push({ content: line, type: 'added', lineNumber: modifiedLineNumber });
          modifiedLineNumber += 1;
          originalLines.push({ content: '', type: 'added', lineNumber: null });
          additions += 1;
        });
      }
      continue;
    }

    if (part.removed) {
      const removedLines = splitIntoLines(part.value);
      if (removedLines.length === 0) {
        originalLines.push({ content: '', type: 'removed', lineNumber: originalLineNumber });
        modifiedLines.push({ content: '', type: 'removed', lineNumber: null });
        deletions += 1;
        originalLineNumber += 1;
      } else {
        removedLines.forEach((line) => {
          originalLines.push({ content: line, type: 'removed', lineNumber: originalLineNumber });
          originalLineNumber += 1;
          modifiedLines.push({ content: '', type: 'removed', lineNumber: null });
          deletions += 1;
        });
      }
      continue;
    }

    const unchangedLines = splitIntoLines(part.value);
    if (unchangedLines.length === 0) {
      continue;
    }

    unchangedLines.forEach((line) => {
      originalLines.push({ content: line, type: 'unchanged', lineNumber: originalLineNumber });
      modifiedLines.push({ content: line, type: 'unchanged', lineNumber: modifiedLineNumber });
      originalLineNumber += 1;
      modifiedLineNumber += 1;
    });
  }

  return {
    original: originalLines,
    modified: modifiedLines,
    stats: { additions, deletions, modifications },
  };
};

const DiffViewer: FC = () => {
  const [originalCode, setOriginalCode] = useState<string>('');
  const [modifiedCode, setModifiedCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');

  const { original, modified, stats } = useMemo(
    () => computeDiff(originalCode, modifiedCode),
    [originalCode, modifiedCode],
  );

  const highlightSyntax = useCallback(
    (code: string): string => {
      if (!code) {
        return '';
      }
      try {
        const grammar = Prism.languages[language] ?? Prism.languages.plaintext;
        return Prism.highlight(code, grammar, language);
      } catch {
        return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    },
    [language],
  );

  const originalLines = useMemo<HighlightedDiffLine[]>(
    () =>
      original.map((line) => ({
        ...line,
        highlightedContent: line.content.length > 0 ? highlightSyntax(line.content) : '&nbsp;',
      })),
    [highlightSyntax, original],
  );

  const modifiedLines = useMemo<HighlightedDiffLine[]>(
    () =>
      modified.map((line) => ({
        ...line,
        highlightedContent: line.content.length > 0 ? highlightSyntax(line.content) : '&nbsp;',
      })),
    [highlightSyntax, modified],
  );

  return (
    <div className="diff-viewer-container">
      <div className="diff-viewer-header">
        <div className="diff-viewer-title">
          <svg className="icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M13.5 2H10L9 1H4L3 2H2.5L2 2.5V6H3V3H6.5L7.5 2H8.5L9.5 3H13V12.5L13.5 13H10V14H13.5L14 13.5V2.5L13.5 2Z" />
            <path d="M5.56 8.56L7 7.12L5.56 5.69L4.85 6.4L5.44 7H0V8H5.44L4.85 8.6L5.56 8.56Z" />
            <path d="M9.41 12.41L8 11L9.41 9.59L10.12 10.3L9.53 10.89H12V5H11V9.89H9.53L10.12 9.3L9.41 9.34V12.41Z" />
          </svg>
          <span>Diff Viewer</span>
        </div>
        <div className="diff-viewer-controls">
          <div className="diff-stats">
            <span className="stat additions">+{stats.additions}</span>
            <span className="stat deletions">-{stats.deletions}</span>
            <span className="stat modifications">~{stats.modifications}</span>
          </div>
          <select
            className="language-selector"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="jsx">JSX</option>
            <option value="tsx">TSX</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="plaintext">Plain Text</option>
          </select>
        </div>
      </div>

      <div className="diff-viewer-body">
        <DiffEditorPane
          title="Original"
          value={originalCode}
          onChange={setOriginalCode}
          onClear={() => setOriginalCode('')}
          placeholder="Paste or type your original code here..."
          lines={originalLines}
        />
        <DiffEditorPane
          title="Modified"
          value={modifiedCode}
          onChange={setModifiedCode}
          onClear={() => setModifiedCode('')}
          placeholder="Paste or type your modified code here..."
          lines={modifiedLines}
        />
      </div>
    </div>
  );
};

export default DiffViewer;
