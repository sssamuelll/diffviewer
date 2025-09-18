import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type {
  ClipboardEvent as ReactClipboardEvent,
  Dispatch,
  ReactElement,
  SetStateAction,
} from 'react';
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
import type { DiffSegment, DiffStats, DiffSegmentType, LanguageOption } from './types';

interface DiffComputation {
  original: DiffSegment[];
  modified: DiffSegment[];
}

interface EditorPaneProps {
  title: string;
  value: string;
  placeholder: string;
  segments: DiffSegment[];
  onChange: (value: string) => void;
  onClear: () => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  highlightCode: (code: string) => string;
}

const languages: LanguageOption[] = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'css',
  'json',
  'plaintext',
];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const computeDiffSegments = (original: string, modified: string): DiffComputation => {
  const parts = Diff.diffWordsWithSpace(original, modified);
  const originalSegments: DiffSegment[] = [];
  const modifiedSegments: DiffSegment[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part.value) {
      continue;
    }

    if (part.removed && parts[index + 1]?.added) {
      const addedPart = parts[index + 1];
      if (addedPart.value) {
        originalSegments.push({ value: part.value, type: 'modify' });
        modifiedSegments.push({ value: addedPart.value, type: 'modify' });
      }
      index += 1;
      continue;
    }

    if (part.added) {
      modifiedSegments.push({ value: part.value, type: 'insert' });
      continue;
    }

    if (part.removed) {
      originalSegments.push({ value: part.value, type: 'delete' });
      continue;
    }

    originalSegments.push({ value: part.value, type: 'equal' });
    modifiedSegments.push({ value: part.value, type: 'equal' });
  }

  return { original: originalSegments, modified: modifiedSegments };
};

const countLines = (value: string): number => {
  if (!value) {
    return 0;
  }

  const lines = value.split('\n');
  return lines.reduce((total, line, lineIndex) => {
    const isLastLine = lineIndex === lines.length - 1;
    if (line.length > 0 || !isLastLine) {
      return total + 1;
    }
    return total;
  }, 0);
};

const getStatsForType = (segments: DiffSegment[], type: DiffSegmentType): number =>
  segments
    .filter((segment) => segment.type === type)
    .reduce((total, segment) => total + countLines(segment.value), 0);

const EditorPane = ({
  title,
  value,
  placeholder,
  segments,
  onChange,
  onClear,
  onPaste,
  highlightCode,
}: EditorPaneProps): ReactElement => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  const handleScroll = useCallback(() => {
    if (!textareaRef.current || !highlightRef.current) {
      return;
    }

    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, []);

  useEffect(() => {
    handleScroll();
  }, [handleScroll, value, segments]);

  const highlightedSegments = useMemo(
    () =>
      segments.map((segment, index) => ({
        key: `${segment.type}-${index}`,
        type: segment.type,
        html: highlightCode(segment.value) || escapeHtml(segment.value) || '&#8203;',
      })),
    [segments, highlightCode]
  );

  return (
    <section className="editor-pane">
      <div className="editor-pane-header">
        <span className="pane-title">{title}</span>
        <button type="button" className="clear-btn" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="editor-wrapper">
        <textarea
          ref={textareaRef}
          className="code-input"
          value={value}
          spellCheck={false}
          wrap="off"
          aria-label={`${title} code editor`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleScroll}
          onPaste={onPaste}
        />
        <pre ref={highlightRef} className="code-highlight" aria-hidden="true">
          <code>
            {highlightedSegments.length > 0 ? (
              highlightedSegments.map((segment) => (
                <span
                  key={segment.key}
                  className={`diff-segment diff-segment-${segment.type}`}
                  dangerouslySetInnerHTML={{ __html: segment.html }}
                />
              ))
            ) : (
              <span className="diff-segment" dangerouslySetInnerHTML={{ __html: '&#8203;' }} />
            )}
          </code>
        </pre>
        {!value && <span className="editor-placeholder">{placeholder}</span>}
      </div>
    </section>
  );
};

const DiffViewer = (): ReactElement => {
  const [originalText, setOriginalText] = useState<string>('');
  const [modifiedText, setModifiedText] = useState<string>('');
  const [language, setLanguage] = useState<LanguageOption>('javascript');

  const { original: originalSegments, modified: modifiedSegments } = useMemo(
    () => computeDiffSegments(originalText, modifiedText),
    [originalText, modifiedText]
  );

  const highlightCode = useCallback(
    (code: string) => {
      if (!code) {
        return '';
      }

      if (language === 'plaintext') {
        return escapeHtml(code);
      }

      const grammar = Prism.languages[language];
      if (!grammar) {
        return escapeHtml(code);
      }

      try {
        return Prism.highlight(code, grammar, language);
      } catch {
        return escapeHtml(code);
      }
    },
    [language]
  );

  const stats = useMemo<DiffStats>(() => {
    const additions = getStatsForType(modifiedSegments, 'insert');
    const deletions = getStatsForType(originalSegments, 'delete');
    const leftModifications = getStatsForType(originalSegments, 'modify');
    const rightModifications = getStatsForType(modifiedSegments, 'modify');

    return {
      additions,
      deletions,
      modifications: Math.max(leftModifications, rightModifications),
    };
  }, [originalSegments, modifiedSegments]);

  const createPasteHandler = useCallback(
    (setter: Dispatch<SetStateAction<string>>) =>
      (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
        event.preventDefault();
        const text = event.clipboardData.getData('text');
        setter(text);
      },
    []
  );

  return (
    <div className="diff-viewer-container">
      <header className="diff-viewer-header">
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
          <label className="language-label">
            <span className="sr-only">Select language</span>
            <select
              className="language-selector"
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageOption)}
            >
              {languages.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <div className="diff-viewer-body">
        <EditorPane
          title="Original"
          value={originalText}
          placeholder="Paste or type your original code here..."
          segments={originalSegments}
          onChange={setOriginalText}
          onClear={() => setOriginalText('')}
          onPaste={createPasteHandler(setOriginalText)}
          highlightCode={highlightCode}
        />
        <EditorPane
          title="Modified"
          value={modifiedText}
          placeholder="Paste or type your modified code here..."
          segments={modifiedSegments}
          onChange={setModifiedText}
          onClear={() => setModifiedText('')}
          onPaste={createPasteHandler(setModifiedText)}
          highlightCode={highlightCode}
        />
      </div>
    </div>
  );
};

export default DiffViewer;
