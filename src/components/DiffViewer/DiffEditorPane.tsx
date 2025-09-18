import { type FC, useCallback, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { type HighlightedDiffLine } from './types';

interface DiffEditorPaneProps {
  readonly title: string;
  readonly value: string;
  readonly placeholder: string;
  readonly onChange: (value: string) => void;
  readonly onClear: () => void;
  readonly lines: HighlightedDiffLine[];
}

const DiffEditorPane: FC<DiffEditorPaneProps> = ({
  title,
  value,
  placeholder,
  onChange,
  onClear,
  lines,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineContainerRef = useRef<HTMLDivElement | null>(null);

  const syncScroll = useCallback((): void => {
    const textarea = textareaRef.current;
    const lineContainer = lineContainerRef.current;
    if (!textarea || !lineContainer) {
      return;
    }

    const { scrollTop, scrollLeft } = textarea;
    lineContainer.style.transform = `translate3d(${-scrollLeft}px, ${-scrollTop}px, 0)`;
  }, []);

  useEffect(() => {
    syncScroll();
  }, [syncScroll, value, lines.length]);

  const placeholderVisible = useMemo(
    () => value.length === 0 && lines.length === 0,
    [lines.length, value.length],
  );

  return (
    <div className="diff-editor-pane">
      <div className="pane-header">
        <span className="pane-title">{title}</span>
        <button className="clear-btn" type="button" onClick={onClear} title="Clear">
          Clear
        </button>
      </div>
      <div className="editor-wrapper">
        <textarea
          ref={textareaRef}
          className="diff-editor-textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          placeholder={placeholder}
          wrap="off"
        />
        <div className="editor-content" aria-hidden={true}>
          <div ref={lineContainerRef} className="editor-lines">
            {placeholderVisible ? (
              <div className="editor-placeholder">{placeholder}</div>
            ) : (
              lines.map((line, index) => (
                <div
                  key={`${line.type}-${line.lineNumber ?? 'blank'}-${index}`}
                  className={clsx('editor-line', {
                    'editor-line-added': line.type === 'added',
                    'editor-line-removed': line.type === 'removed',
                    'editor-line-modified': line.type === 'modified',
                  })}
                >
                  <span className="line-number">{line.lineNumber ?? ''}</span>
                  <span
                    className="line-code"
                    dangerouslySetInnerHTML={{
                      __html: line.highlightedContent.length > 0 ? line.highlightedContent : '&nbsp;',
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffEditorPane;
