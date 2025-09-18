import { useCallback, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, UIEvent } from 'react';
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
import type { DiffComputation, DiffStats, PaneDiffLine } from './types';
import clsx from 'clsx';

type LanguageOption = {
  value: string;
  label: string;
};

interface DiffEditorPaneProps {
  title: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onClear: () => void;
  lines: PaneDiffLine[];
  highlightSyntax: (code: string) => string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'plaintext', label: 'Plain Text' },
];

const DiffViewer: React.FC = () => {
  const [originalCode, setOriginalCode] = useState<string>('');
  const [modifiedCode, setModifiedCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');

  const diffComputation = useMemo<DiffComputation>(() => {
    return computeDiff(originalCode, modifiedCode);
  }, [originalCode, modifiedCode]);

  const highlightSyntax = useCallback(
    (code: string): string => {
      if (!code) {
        return '&nbsp;';
      }

      try {
        const grammar = Prism.languages[language] || Prism.languages.plaintext;
        return Prism.highlight(code, grammar, language);
      } catch {
        return code;
      }
    },
    [language]
  );

  const handlePaste = useCallback(
    (setter: (value: string) => void) =>
      (event: ClipboardEvent<HTMLTextAreaElement>) => {
        event.preventDefault();
        const text = event.clipboardData.getData('text');
        setter(text);
      },
    []
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
          <DiffSummary stats={diffComputation.stats} />
          <select
            className="language-selector"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="diff-columns">
        <DiffEditorPane
          title="Original"
          value={originalCode}
          placeholder="Paste or type your original code here..."
          onChange={setOriginalCode}
          onPaste={handlePaste(setOriginalCode)}
          onClear={() => setOriginalCode('')}
          lines={diffComputation.original}
          highlightSyntax={highlightSyntax}
        />
        <DiffEditorPane
          title="Modified"
          value={modifiedCode}
          placeholder="Paste or type your modified code here..."
          onChange={setModifiedCode}
          onPaste={handlePaste(setModifiedCode)}
          onClear={() => setModifiedCode('')}
          lines={diffComputation.modified}
          highlightSyntax={highlightSyntax}
        />
      </div>
    </div>
  );
};

const computeDiff = (original: string, modified: string): DiffComputation => {
  if (!original && !modified) {
    return {
      original: [],
      modified: [],
      stats: { additions: 0, deletions: 0, modifications: 0 },
    };
  }

  const diffParts = Diff.diffLines(original, modified);
  const originalLines: PaneDiffLine[] = [];
  const modifiedLines: PaneDiffLine[] = [];

  let originalLineNumber = 1;
  let modifiedLineNumber = 1;
  let additions = 0;
  let deletions = 0;
  let modificationsCount = 0;

  for (let index = 0; index < diffParts.length; index += 1) {
    const part = diffParts[index];
    const currentLines = extractLines(part.value);

    if (part.removed) {
      const nextPart = diffParts[index + 1];

      if (nextPart?.added) {
        const nextLines = extractLines(nextPart.value);
        const pairedLength = Math.min(currentLines.length, nextLines.length);

        for (let pairIndex = 0; pairIndex < pairedLength; pairIndex += 1) {
          originalLines.push({
            type: 'modified',
            content: currentLines[pairIndex],
            lineNumber: originalLineNumber++,
          });
          modifiedLines.push({
            type: 'modified',
            content: nextLines[pairIndex],
            lineNumber: modifiedLineNumber++,
          });
          modificationsCount += 1;
        }

        if (currentLines.length > pairedLength) {
          for (let leftover = pairedLength; leftover < currentLines.length; leftover += 1) {
            originalLines.push({
              type: 'removed',
              content: currentLines[leftover],
              lineNumber: originalLineNumber++,
            });
            deletions += 1;
          }
        }

        if (nextLines.length > pairedLength) {
          for (let leftover = pairedLength; leftover < nextLines.length; leftover += 1) {
            modifiedLines.push({
              type: 'added',
              content: nextLines[leftover],
              lineNumber: modifiedLineNumber++,
            });
            additions += 1;
          }
        }

        index += 1;
        continue;
      }

      for (const line of currentLines) {
        originalLines.push({
          type: 'removed',
          content: line,
          lineNumber: originalLineNumber++,
        });
        deletions += 1;
      }
      continue;
    }

    if (part.added) {
      for (const line of currentLines) {
        modifiedLines.push({
          type: 'added',
          content: line,
          lineNumber: modifiedLineNumber++,
        });
        additions += 1;
      }
      continue;
    }

    for (const line of currentLines) {
      originalLines.push({
        type: 'unchanged',
        content: line,
        lineNumber: originalLineNumber++,
      });
      modifiedLines.push({
        type: 'unchanged',
        content: line,
        lineNumber: modifiedLineNumber++,
      });
    }
  }

  return {
    original: originalLines,
    modified: modifiedLines,
    stats: {
      additions,
      deletions,
      modifications: modificationsCount,
    },
  };
};

const extractLines = (value: string): string[] => {
  if (!value) {
    return [];
  }

  const splitLines = value.split('\n');
  if (splitLines.length > 0 && splitLines[splitLines.length - 1] === '') {
    splitLines.pop();
  }
  return splitLines;
};

const DiffSummary: React.FC<{ stats: DiffStats }> = ({ stats }) => {
  return (
    <div className="diff-stats">
      <span className="stat additions">+{stats.additions}</span>
      <span className="stat deletions">-{stats.deletions}</span>
      <span className="stat modifications">±{stats.modifications}</span>
    </div>
  );
};

const DiffEditorPane: React.FC<DiffEditorPaneProps> = ({
  title,
  value,
  placeholder,
  onChange,
  onPaste,
  onClear,
  lines,
  highlightSyntax,
}) => {
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;
    if (highlightRef.current) {
      highlightRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
    }
  }, []);

  return (
    <section className="diff-pane">
      <header className="pane-header">
        <span className="pane-title">{title}</span>
        <button className="clear-btn" type="button" onClick={onClear}>
          Clear
        </button>
      </header>
      <div className="pane-editor">
        <div className="code-layer" aria-hidden="true">
          <div className="code-layer-scroll" ref={highlightRef}>
            {lines.length > 0 ? (
              lines.map((line) => (
                <div
                  key={line.lineNumber}
                  className={clsx('code-line', {
                    'code-line--added': line.type === 'added',
                    'code-line--removed': line.type === 'removed',
                    'code-line--modified': line.type === 'modified',
                  })}
                >
                  <span className="code-line-number">{line.lineNumber}</span>
                  <span
                    className="code-line-content"
                    dangerouslySetInnerHTML={{ __html: highlightSyntax(line.content) }}
                  />
                </div>
              ))
            ) : (
              <div className="code-line code-line--empty">
                <span className="code-line-number">1</span>
                <span className="code-line-content">&nbsp;</span>
              </div>
            )}
          </div>
        </div>
        <textarea
          className="code-input"
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          wrap="off"
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleScroll}
          onPaste={onPaste}
        />
      </div>
    </section>
  );
};

export default DiffViewer;