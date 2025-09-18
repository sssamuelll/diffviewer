/* eslint-disable no-self-assign */
import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';
import * as Diff from 'diff';

// ⬇️ highlight.js
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml'; // html
import css from 'highlight.js/lib/languages/css';
import plaintext from 'highlight.js/lib/languages/plaintext';

import 'highlight.js/styles/vs2015.css';

import './DiffViewer.css';
import type { DiffSegment, DiffStats, DiffSegmentType, LanguageOption } from './types';

// registra solo lo que usas (bundle pequeño)
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('plaintext', plaintext);

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
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  detectedLanguage: LanguageOption;
  highlightCode: (code: string, lang: LanguageOption) => string;
}

// ---------------- utils ----------------

const INDENT = '  '; // 2 espacios (cámbialo por '\t' si prefieres tab real)

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
    if (!part.value) continue;

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
  if (!value) return 0;
  const lines = value.split('\n');
  return lines.reduce((total, line, i) => {
    const isLast = i === lines.length - 1;
    return total + ((line.length > 0 || !isLast) ? 1 : 0);
  }, 0);
};

const getStatsForType = (segments: DiffSegment[], type: DiffSegmentType): number =>
  segments
    .filter((segment) => segment.type === type)
    .reduce((total, segment) => total + countLines(segment.value), 0);

/** ---------- AUTO-DETECCIÓN DE LENGUAJE ---------- */
const HLJS_SUBSET: LanguageOption[] = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'css',
  'plaintext',
];

const detectLanguage = (text: string): LanguageOption => {
  const t = text.trim();
  if (!t) return 'plaintext';
  const res = hljs.highlightAuto(t, HLJS_SUBSET);
  const lang = (res.language as LanguageOption) || 'plaintext';
  return HLJS_SUBSET.includes(lang) ? lang : 'plaintext';
};

const highlightCode = (code: string, lang: LanguageOption): string => {
  if (!code) return '';
  if (lang === 'plaintext') return escapeHtml(code);
  try {
    return hljs.highlight(code, { language: lang }).value;
  } catch {
    return escapeHtml(code);
  }
};

// ---------------- helpers de edición ----------------

const getLineStart = (text: string, index: number) =>
  text.lastIndexOf('\n', Math.max(0, index - 1)) + 1;

const getLineEnd = (text: string, index: number) => {
  const nl = text.indexOf('\n', index);
  return nl === -1 ? text.length : nl;
};

function indentSelection(text: string, selStart: number, selEnd: number) {
  const start = getLineStart(text, selStart);
  const end = getLineEnd(text, selEnd);
  const before = text.slice(0, start);
  const block = text.slice(start, end);
  const after = text.slice(end);

  const indented = block
    .split('\n')
    .map(line => INDENT + line)
    .join('\n');

  const newText = before + indented + after;
  const newStart = selStart + INDENT.length;
  const newEnd = selEnd + INDENT.length * (block.split('\n').length);
  return { newText, newStart, newEnd };
}

function outdentSelection(text: string, selStart: number, selEnd: number) {
  const start = getLineStart(text, selStart);
  const end = getLineEnd(text, selEnd);
  const before = text.slice(0, start);
  const block = text.slice(start, end);
  const after = text.slice(end);

  let removedTotal = 0;
  const outdented = block
    .split('\n')
    .map(line => {
      if (line.startsWith(INDENT)) {
        removedTotal += INDENT.length;
        return line.slice(INDENT.length);
      }
      if (line.startsWith('\t')) {
        removedTotal += 1;
        return line.slice(1);
      }
      return line;
    })
    .join('\n');

  const newText = before + outdented + after;

  // ajustar selección: no dejes que vaya por debajo del inicio real
  const firstLineRemoved = text.slice(start, start + INDENT.length) === INDENT ? INDENT.length
                        : text[start] === '\t' ? 1 : 0;

  const newStart = Math.max(start, selStart - firstLineRemoved);
  const linesCount = block.split('\n').length;
  const newEnd = Math.max(newStart, selEnd - removedTotal);

  return { newText, newStart, newEnd, linesCount };
}

function insertAt(text: string, start: number, end: number, insert: string) {
  return text.slice(0, start) + insert + text.slice(end);
}

// ---------------- componentes ----------------

const EditorPane = ({
  title,
  value,
  placeholder,
  segments,
  onChange,
  onClear,
  onPaste,
  detectedLanguage,
  highlightCode,
}: EditorPaneProps): ReactElement => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  const handleScroll = useCallback(() => {
    if (!textareaRef.current || !highlightRef.current) return;
    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, []);

  useEffect(() => {
    handleScroll();
  }, [handleScroll, value, segments]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const selStart = ta.selectionStart ?? 0;
    const selEnd = ta.selectionEnd ?? 0;

    // TAB / SHIFT+TAB
    if (e.key === 'Tab') {
      e.preventDefault();

      // selección múltiple líneas → indentar todas
      if (selStart !== selEnd) {
        if (e.shiftKey) {
          const { newText, newStart, newEnd } = outdentSelection(value, selStart, selEnd);
          onChange(newText);
          requestAnimationFrame(() => {
            ta.selectionStart = newStart;
            ta.selectionEnd = newEnd;
          });
        } else {
          const { newText, newStart, newEnd } = indentSelection(value, selStart, selEnd);
          onChange(newText);
          requestAnimationFrame(() => {
            ta.selectionStart = newStart;
            ta.selectionEnd = newEnd;
          });
        }
        return;
      }

      // sin selección → insertar indent en la posición
      if (e.shiftKey) {
        // outdent en la línea actual
        const lineStart = getLineStart(value, selStart);
        if (value.slice(lineStart, lineStart + INDENT.length) === INDENT) {
          const newText = insertAt(value, lineStart, lineStart + INDENT.length, '');
          onChange(newText);
          const newPos = Math.max(lineStart, selStart - INDENT.length);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = newPos;
          });
        } else if (value[lineStart] === '\t') {
          const newText = insertAt(value, lineStart, lineStart + 1, '');
          onChange(newText);
          const newPos = Math.max(lineStart, selStart - 1);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = newPos;
          });
        }
      } else {
        const newText = insertAt(value, selStart, selEnd, INDENT);
        onChange(newText);
        const caret = selStart + INDENT.length;
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = caret;
        });
      }
      return;
    }

    // ENTER → auto-indent
    if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const lineStart = getLineStart(value, selStart);
      const currentLine = value.slice(lineStart, selStart);
      const leading = currentLine.match(/^[ \t]*/)?.[0] ?? '';
      const insertion = '\n' + leading;
      const newText = insertAt(value, selStart, selEnd, insertion);
      onChange(newText);
      const caret = selStart + insertion.length;
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = caret;
        ta.scrollTop = ta.scrollTop; // mantiene el scroll
      });
      return;
    }
  }, [onChange, value]);

  const highlightedSegments = useMemo(
    () =>
      segments.map((segment, index) => ({
        key: `${segment.type}-${index}`,
        type: segment.type,
        html: highlightCode(segment.value, detectedLanguage) || escapeHtml(segment.value) || '&#8203;',
      })),
    [segments, highlightCode, detectedLanguage]
  );

  const prettyName = (lang: LanguageOption) => lang.toUpperCase();

  return (
    <section className="editor-pane">
      <div className="editor-pane-header">
        <span className="pane-title">
          {title} {detectedLanguage !== 'plaintext' ? `· ${prettyName(detectedLanguage)}` : ''}
        </span>
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
          onKeyDown={handleKeyDown}
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

  const { original: originalSegments, modified: modifiedSegments } = useMemo(
    () => computeDiffSegments(originalText, modifiedText),
    [originalText, modifiedText]
  );

  const originalLang = useMemo<LanguageOption>(() => detectLanguage(originalText), [originalText]);
  const modifiedLang = useMemo<LanguageOption>(() => detectLanguage(modifiedText), [modifiedText]);

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
      (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
          {/* Detección automática por panel con highlight.js */}
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
          detectedLanguage={originalLang}
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
          detectedLanguage={modifiedLang}
          highlightCode={highlightCode}
        />
      </div>
    </div>
  );
};

export default DiffViewer;
