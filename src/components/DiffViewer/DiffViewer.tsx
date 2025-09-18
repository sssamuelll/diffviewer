import { useMemo, useState, type ReactElement } from 'react';
import * as Diff from 'diff';

// HLJS solo para auto-detección
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import plaintext from 'highlight.js/lib/languages/plaintext';
import 'highlight.js/styles/vs2015.css';

import './DiffViewer.css';
import MonacoDiff from '../MonacoPane/MonacoDiffPane';
import type { DiffSegment, DiffStats, DiffSegmentType, LanguageOption } from './types';

// registra lenguajes usados
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

const computeDiffSegments = (original: string, modified: string): DiffComputation => {
  const parts = Diff.diffWordsWithSpace(original, modified);
  const originalSegments: DiffSegment[] = [];
  const modifiedSegments: DiffSegment[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part.value) continue;

    if (part.removed && parts[i + 1]?.added) {
      const addedPart = parts[i + 1];
      if (addedPart.value) {
        originalSegments.push({ value: part.value, type: 'modify' });
        modifiedSegments.push({ value: addedPart.value, type: 'modify' });
      }
      i += 1;
      continue;
    }
    if (part.added) { modifiedSegments.push({ value: part.value, type: 'insert' }); continue; }
    if (part.removed) { originalSegments.push({ value: part.value, type: 'delete' }); continue; }

    originalSegments.push({ value: part.value, type: 'equal' });
    modifiedSegments.push({ value: part.value, type: 'equal' });
  }

  return { original: originalSegments, modified: modifiedSegments };
};

const countLines = (value: string): number => {
  if (!value) return 0;
  const lines = value.split('\n');
  return lines.reduce((t, line, i) => t + ((line.length > 0 || i !== lines.length - 1) ? 1 : 0), 0);
};

const getStatsForType = (segments: DiffSegment[], type: DiffSegmentType): number =>
  segments.filter(s => s.type === type).reduce((t, s) => t + countLines(s.value), 0);

/** ---------- AUTO-DETECCIÓN (highlight.js) ---------- */
const HLJS_SUBSET: LanguageOption[] = [
  'javascript', 'typescript', 'jsx', 'tsx', 'json', 'css', 'xml', 'plaintext',
];

const detectLanguage = (text: string): LanguageOption => {
  const t = text.trim();
  if (!t) return 'plaintext';
  const res = hljs.highlightAuto(t, HLJS_SUBSET);
  const lang = (res.language as LanguageOption) || 'plaintext';
  return HLJS_SUBSET.includes(lang) ? lang : 'plaintext';
};
/** --------------------------------------------------- */

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
    const leftMod = getStatsForType(originalSegments, 'modify');
    const rightMod = getStatsForType(modifiedSegments, 'modify');
    return { additions, deletions, modifications: Math.max(leftMod, rightMod) };
  }, [originalSegments, modifiedSegments]);

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
        </div>
      </header>

      <div className="diff-viewer-body">
        {/* Encabezados + CLEAR */}
        <section className="editor-pane">
          <div className="editor-pane-header">
            <span className="pane-title">
              ORIGINAL {originalLang !== 'plaintext' ? `· ${originalLang.toUpperCase()}` : ''}
            </span>
            <button type="button" className="clear-btn" onClick={() => setOriginalText('')}>
              Clear
            </button>
          </div>
        </section>
        <section className="editor-pane">
          <div className="editor-pane-header">
            <span className="pane-title">
              MODIFIED {modifiedLang !== 'plaintext' ? `· ${modifiedLang.toUpperCase()}` : ''}
            </span>
            <button type="button" className="clear-btn" onClick={() => setModifiedText('')}>
              Clear
            </button>
          </div>
        </section>

        {/* Diff real con Monaco */}
        <div style={{ gridColumn: '1 / -1', height: 'calc(100vh - 80px)' }}>
          <MonacoDiff
            original={originalText}
            modified={modifiedText}
            leftLang={originalLang}
            rightLang={modifiedLang}
            onOriginalChange={setOriginalText}
            onModifiedChange={setModifiedText}
          />
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;
