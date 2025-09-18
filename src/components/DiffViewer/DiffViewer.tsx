import { useCallback, useMemo, useRef, useState } from 'react';
import type { ClipboardEventHandler, UIEventHandler } from 'react';
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
import clsx from 'clsx';
import {
  type DiffLineType,
  type DiffPaneLine,
  type DiffToken,
  type DiffTokenType,
  type InlineDiffResult,
} from './types';

const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'css',
  'json',
  'plaintext',
]);

type DiffSide = 'left' | 'right';

const splitLines = (value: string): string[] => value.split('\n');

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ensureTokens = (tokens: DiffToken[]): DiffToken[] =>
  tokens.length > 0 ? tokens : [{ value: '', type: 'context' }];

const buildTokens = (
  leftContent: string,
  rightContent: string,
  lineType: DiffLineType,
  side: DiffSide,
): DiffToken[] => {
  if (lineType === 'modified') {
    const wordDiff = Diff.diffWordsWithSpace(leftContent, rightContent);
    const tokens = wordDiff
      .map((part): DiffToken | null => {
        if (side === 'left') {
          if (part.added) {
            return null;
          }
          return {
            value: part.value,
            type: part.removed ? 'deletion' : 'context',
          };
        }

        if (part.removed) {
          return null;
        }
        return {
          value: part.value,
          type: part.added ? 'addition' : 'context',
        };
      })
      .filter((token): token is DiffToken => token !== null);

    return ensureTokens(tokens);
  }

  const baseValue = side === 'left' ? leftContent : rightContent;
  const tokenType: DiffTokenType =
    lineType === 'added'
      ? 'addition'
      : lineType === 'removed'
        ? 'deletion'
        : 'context';

  return ensureTokens([{ value: baseValue, type: tokenType }]);
};

const computeInlineDiff = (left: string, right: string): InlineDiffResult => {
  const diff = Diff.diffLines(left, right);
  const leftLines: DiffPaneLine[] = [];
  const rightLines: DiffPaneLine[] = [];

  let leftLineNumber = 1;
  let rightLineNumber = 1;
  let additions = 0;
  let deletions = 0;
  let modifications = 0;

  for (let index = 0; index < diff.length; index += 1) {
    const part = diff[index];
    const partLines = splitLines(part.value);

    if (part.removed && diff[index + 1]?.added) {
      const addedPart = diff[index + 1];
      const addedLines = splitLines(addedPart.value);
      const longest = Math.max(partLines.length, addedLines.length);
      const sharedLength = Math.min(partLines.length, addedLines.length);
      modifications += sharedLength;

      for (let lineIndex = 0; lineIndex < longest; lineIndex += 1) {
        const removedLine = partLines[lineIndex];
        const addedLine = addedLines[lineIndex];

        if (removedLine !== undefined) {
          const lineType: DiffLineType = addedLine !== undefined ? 'modified' : 'removed';
          if (lineType === 'removed') {
            deletions += 1;
          }
          leftLines.push({
            id: `L-${leftLineNumber}-${index}-${lineIndex}`,
            lineNumber: leftLineNumber,
            text: removedLine,
            type: lineType,
            tokens: buildTokens(removedLine, addedLine ?? '', lineType, 'left'),
          });
          leftLineNumber += 1;
        }

        if (addedLine !== undefined) {
          const lineType: DiffLineType = removedLine !== undefined ? 'modified' : 'added';
          if (lineType === 'added') {
            additions += 1;
          }
          rightLines.push({
            id: `R-${rightLineNumber}-${index}-${lineIndex}`,
            lineNumber: rightLineNumber,
            text: addedLine,
            type: lineType,
            tokens: buildTokens(removedLine ?? '', addedLine, lineType, 'right'),
          });
          rightLineNumber += 1;
        }
      }

      index += 1;
      continue;
    }

    if (part.added) {
      additions += partLines.length;
      partLines.forEach((line, lineIndex) => {
        rightLines.push({
          id: `R-${rightLineNumber}-${index}-${lineIndex}`,
          lineNumber: rightLineNumber,
          text: line,
          type: 'added',
          tokens: buildTokens('', line, 'added', 'right'),
        });
        rightLineNumber += 1;
      });
      continue;
    }

    if (part.removed) {
      deletions += partLines.length;
      partLines.forEach((line, lineIndex) => {
        leftLines.push({
          id: `L-${leftLineNumber}-${index}-${lineIndex}`,
          lineNumber: leftLineNumber,
          text: line,
          type: 'removed',
          tokens: buildTokens(line, '', 'removed', 'left'),
        });
        leftLineNumber += 1;
      });
      continue;
    }

    partLines.forEach((line, lineIndex) => {
      leftLines.push({
        id: `L-${leftLineNumber}-${index}-${lineIndex}`,
        lineNumber: leftLineNumber,
        text: line,
        type: 'unchanged',
        tokens: buildTokens(line, line, 'unchanged', 'left'),
      });
      rightLines.push({
        id: `R-${rightLineNumber}-${index}-${lineIndex}`,
        lineNumber: rightLineNumber,
        text: line,
        type: 'unchanged',
        tokens: buildTokens(line, line, 'unchanged', 'right'),
      });
      leftLineNumber += 1;
      rightLineNumber += 1;
    });
  }

  const stats = { additions, deletions, modifications };
  return { left: leftLines, right: rightLines, stats };
};

const createPlaceholderLine = (side: DiffSide): DiffPaneLine => ({
  id: `${side}-placeholder`,
  lineNumber: 1,
  text: '',
  type: 'unchanged',
  tokens: [{ value: '', type: 'context' }],
});

interface InlineDiffEditorProps {
  title: string;
  side: DiffSide;
  value: string;
  placeholder: string;
  lines: DiffPaneLine[];
  onChange: (value: string) => void;
  onPaste: ClipboardEventHandler<HTMLTextAreaElement>;
  onClear: () => void;
  highlight: (code: string) => string;
}

const InlineDiffEditor: React.FC<InlineDiffEditorProps> = ({
  title,
  side,
  value,
  placeholder,
  lines,
  onChange,
  onPaste,
  onClear,
  highlight,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const handleScroll: UIEventHandler<HTMLTextAreaElement> = (event) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = event.currentTarget.scrollTop;
      overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  const renderedLines = lines.length > 0 ? lines : [createPlaceholderLine(side)];

  return (
    <div className="diff-editor-pane">
      <div className="pane-header">
        <span className="pane-title">{title}</span>
        <button className="clear-btn" onClick={onClear} type="button">
          Clear
        </button>
      </div>
      <div className="editor-wrapper">
        <textarea
          ref={textareaRef}
          className="editor-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={onPaste}
          onScroll={handleScroll}
          placeholder={placeholder}
          spellCheck={false}
        />
        <div className="editor-overlay" ref={overlayRef} aria-hidden>
          <div className="code-lines">
            {renderedLines.map((line) => (
              <div
                key={line.id}
                className={clsx('code-line', {
                  'line-added': line.type === 'added',
                  'line-removed': line.type === 'removed',
                  'line-modified': line.type === 'modified',
                })}
              >
                <span className="line-number">{line.lineNumber}</span>
                <span className="line-content">
                  {line.tokens.map((token, index) => (
                    <span
                      key={`${line.id}-token-${index}`}
                      className={clsx('code-token', {
                        'token-addition': token.type === 'addition',
                        'token-deletion': token.type === 'deletion',
                      })}
                      dangerouslySetInnerHTML={{
                        __html: token.value === '' ? '&nbsp;' : highlight(token.value),
                      }}
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DiffViewer: React.FC = () => {
  const [leftText, setLeftText] = useState<string>('');
  const [rightText, setRightText] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');

  const diffResult = useMemo(() => computeInlineDiff(leftText, rightText), [leftText, rightText]);

  const highlight = useCallback(
    (code: string): string => {
      if (!code) {
        return '&nbsp;';
      }

      const selectedLanguage = SUPPORTED_LANGUAGES.has(language)
        ? language
        : 'plaintext';

      try {
        const grammar = Prism.languages[selectedLanguage] || Prism.languages.plaintext;
        return Prism.highlight(code, grammar, selectedLanguage);
      } catch {
        return escapeHtml(code);
      }
    },
    [language],
  );

  const handlePaste = (
    setter: (value: string) => void,
  ): ClipboardEventHandler<HTMLTextAreaElement> => (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text');
    setter(text);
  };

  const { stats, left, right } = diffResult;

  return (
    <div className="diff-viewer-container">
      <div className="diff-viewer-header">
        <div className="diff-viewer-title">
          <svg className="icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
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
        <InlineDiffEditor
          title="Original"
          side="left"
          value={leftText}
          placeholder="Type or paste your original code..."
          lines={left}
          onChange={setLeftText}
          onPaste={handlePaste(setLeftText)}
          onClear={() => setLeftText('')}
          highlight={highlight}
        />
        <InlineDiffEditor
          title="Modified"
          side="right"
          value={rightText}
          placeholder="Type or paste your modified code..."
          lines={right}
          onChange={setRightText}
          onPaste={handlePaste(setRightText)}
          onClear={() => setRightText('')}
          highlight={highlight}
        />
      </div>
    </div>
  );
};

export default DiffViewer;
