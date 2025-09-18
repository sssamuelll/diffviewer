import { useState, useMemo } from 'react';
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
import { type DiffLine, type DiffViewMode } from './types';
import clsx from 'clsx';

const DiffViewer: React.FC = () => {
  const [leftText, setLeftText] = useState<string>('');
  const [rightText, setRightText] = useState<string>('');
  const [viewMode, setViewMode] = useState<DiffViewMode>('split');
  const [language, setLanguage] = useState<string>('javascript');

  const diffLines = useMemo((): DiffLine[] => {
    if (!leftText && !rightText) return [];

    const diff = Diff.diffLines(leftText, rightText);
    const lines: DiffLine[] = [];
    let leftLineNumber = 1;
    let rightLineNumber = 1;

    diff.forEach((part) => {
      const partLines = part.value.split('\n').filter((_, index, arr) => 
        index < arr.length - 1 || part.value[part.value.length - 1] !== '\n'
      );

      partLines.forEach((line) => {
        if (part.added) {
          lines.push({
            type: 'added',
            leftContent: '',
            rightContent: line,
            leftLineNumber: null,
            rightLineNumber: rightLineNumber++,
          });
        } else if (part.removed) {
          lines.push({
            type: 'removed',
            leftContent: line,
            rightContent: '',
            leftLineNumber: leftLineNumber++,
            rightLineNumber: null,
          });
        } else {
          lines.push({
            type: 'unchanged',
            leftContent: line,
            rightContent: line,
            leftLineNumber: leftLineNumber++,
            rightLineNumber: rightLineNumber++,
          });
        }
      });
    });

    return lines;
  }, [leftText, rightText]);

  const highlightSyntax = (code: string): string => {
    if (!code) return '';
    try {
      const grammar = Prism.languages[language] || Prism.languages.plaintext;
      return Prism.highlight(code, grammar, language);
    } catch {
      return code;
    }
  };

  const handlePaste = (setter: (value: string) => void) => (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    setter(text);
  };

  const stats = useMemo(() => {
    const additions = diffLines.filter(l => l.type === 'added').length;
    const deletions = diffLines.filter(l => l.type === 'removed').length;
    return { additions, deletions };
  }, [diffLines]);

  return (
    <div className="diff-viewer-container">
      <div className="diff-viewer-header">
        <div className="diff-viewer-title">
          <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.5 2H10L9 1H4L3 2H2.5L2 2.5V6H3V3H6.5L7.5 2H8.5L9.5 3H13V12.5L13.5 13H10V14H13.5L14 13.5V2.5L13.5 2Z"/>
            <path d="M5.56 8.56L7 7.12L5.56 5.69L4.85 6.4L5.44 7H0V8H5.44L4.85 8.6L5.56 8.56Z"/>
            <path d="M9.41 12.41L8 11L9.41 9.59L10.12 10.3L9.53 10.89H12V5H11V9.89H9.53L10.12 9.3L9.41 9.34V12.41Z"/>
          </svg>
          <span>Diff Viewer</span>
        </div>
        <div className="diff-viewer-controls">
          <div className="diff-stats">
            <span className="stat additions">+{stats.additions}</span>
            <span className="stat deletions">-{stats.deletions}</span>
          </div>
          <select 
            className="language-selector"
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="jsx">JSX</option>
            <option value="tsx">TSX</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="plaintext">Plain Text</option>
          </select>
          <div className="view-mode-toggle">
            <button 
              className={clsx('view-mode-btn', { active: viewMode === 'split' })}
              onClick={() => setViewMode('split')}
              title="Split View"
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 1v14h14V1H1zm1 1h5.5v12H2V2zm6.5 12V2H14v12H8.5z"/>
              </svg>
            </button>
            <button 
              className={clsx('view-mode-btn', { active: viewMode === 'unified' })}
              onClick={() => setViewMode('unified')}
              title="Unified View"
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 1v14h14V1H1zm1 1h12v12H2V2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="diff-viewer-input">
        <div className="input-pane">
          <div className="pane-header">
            <span className="pane-title">Original</span>
            <button 
              className="clear-btn"
              onClick={() => setLeftText('')}
              title="Clear"
            >
              Clear
            </button>
          </div>
          <textarea
            className="code-input"
            value={leftText}
            onChange={(e) => setLeftText(e.target.value)}
            onPaste={handlePaste(setLeftText)}
            placeholder="Paste or type your original code here..."
            spellCheck={false}
          />
        </div>
        <div className="input-pane">
          <div className="pane-header">
            <span className="pane-title">Modified</span>
            <button 
              className="clear-btn"
              onClick={() => setRightText('')}
              title="Clear"
            >
              Clear
            </button>
          </div>
          <textarea
            className="code-input"
            value={rightText}
            onChange={(e) => setRightText(e.target.value)}
            onPaste={handlePaste(setRightText)}
            placeholder="Paste or type your modified code here..."
            spellCheck={false}
          />
        </div>
      </div>

      <div className="diff-viewer-output">
        {viewMode === 'split' ? (
          <div className="diff-split-view">
            <div className="diff-pane diff-pane-left">
              <div className="diff-pane-header">
                <span>Original</span>
              </div>
              <div className="diff-content">
                {diffLines.map((line, index) => (
                  <div
                    key={index}
                    className={clsx('diff-line', {
                      'diff-line-removed': line.type === 'removed',
                      'diff-line-empty': line.type === 'added',
                    })}
                  >
                    <span className="line-number">
                      {line.leftLineNumber || ''}
                    </span>
                    <pre className="line-content">
                      {line.type !== 'added' && (
                        <code 
                          dangerouslySetInnerHTML={{ 
                            __html: highlightSyntax(line.leftContent) 
                          }} 
                        />
                      )}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
            <div className="diff-pane diff-pane-right">
              <div className="diff-pane-header">
                <span>Modified</span>
              </div>
              <div className="diff-content">
                {diffLines.map((line, index) => (
                  <div
                    key={index}
                    className={clsx('diff-line', {
                      'diff-line-added': line.type === 'added',
                      'diff-line-empty': line.type === 'removed',
                    })}
                  >
                    <span className="line-number">
                      {line.rightLineNumber || ''}
                    </span>
                    <pre className="line-content">
                      {line.type !== 'removed' && (
                        <code 
                          dangerouslySetInnerHTML={{ 
                            __html: highlightSyntax(line.rightContent) 
                          }} 
                        />
                      )}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="diff-unified-view">
            <div className="diff-pane">
              <div className="diff-pane-header">
                <span>Changes</span>
              </div>
              <div className="diff-content">
                {diffLines.map((line, index) => (
                  <div
                    key={index}
                    className={clsx('diff-line', {
                      'diff-line-added': line.type === 'added',
                      'diff-line-removed': line.type === 'removed',
                    })}
                  >
                    <span className="line-number">
                      {line.type === 'removed' 
                        ? line.leftLineNumber 
                        : line.rightLineNumber || ''}
                    </span>
                    <span className="diff-marker">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <pre className="line-content">
                      <code 
                        dangerouslySetInnerHTML={{ 
                          __html: highlightSyntax(
                            line.type === 'removed' ? line.leftContent : line.rightContent
                          ) 
                        }} 
                      />
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiffViewer;