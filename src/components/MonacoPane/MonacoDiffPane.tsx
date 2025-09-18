import {
  DiffEditor,
  type DiffOnMount,
  type BeforeMount,
} from '@monaco-editor/react';
// 👇 importa los tipos del namespace real de monaco-editor
import type { editor as MonacoEditor } from 'monaco-editor';
import { useEffect, useState, useRef, useCallback } from 'react';
import type { LanguageOption } from '../DiffViewer/types';

type MonacoLang = 'javascript' | 'typescript' | 'json' | 'html' | 'css' | 'plaintext';

const langMap: Record<LanguageOption, MonacoLang> = {
  javascript: 'javascript',
  typescript: 'typescript',
  json: 'json',
  xml: 'html',
  css: 'css',
  plaintext: 'plaintext',
  jsx: 'javascript',
  tsx: 'typescript',
};

interface MonacoDiffProps {
  original: string;
  modified: string;
  leftLang: LanguageOption;
  rightLang: LanguageOption;
  onOriginalChange: (next: string) => void;
  onModifiedChange: (next: string) => void;
}

const beforeMount: BeforeMount = (monaco) => {
  // 🚫 desactivar validación/diagnósticos
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: false,
    enableSchemaRequest: false,
  });
};

export default function MonacoDiff({
  original,
  modified,
  leftLang,
  rightLang,
  onOriginalChange,
  onModifiedChange,
}: MonacoDiffProps) {
  const [stickyLanguage, setStickyLanguage] = useState<MonacoLang>('plaintext');
  const editorRef = useRef<MonacoEditor.IStandaloneDiffEditor | null>(null);
  const originalModelRef = useRef<MonacoEditor.ITextModel | null>(null);
  const modifiedModelRef = useRef<MonacoEditor.ITextModel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced callbacks to update React state only for stats
  const debouncedOriginalChange = useCallback((value: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onOriginalChange(value);
    }, 150);
  }, [onOriginalChange]);

  const debouncedModifiedChange = useCallback((value: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onModifiedChange(value);
    }, 150);
  }, [onModifiedChange]);

  // Handle external changes to original prop (like Clear button)
  useEffect(() => {
    if (originalModelRef.current && original !== originalModelRef.current.getValue()) {
      const editor = editorRef.current?.getOriginalEditor();
      if (editor) {
        const viewState = editor.saveViewState();
        originalModelRef.current.setValue(original);
        if (viewState) {
          editor.restoreViewState(viewState);
        }
        editor.focus();
      }
    }
  }, [original]);

  // Handle external changes to modified prop
  useEffect(() => {
    if (modifiedModelRef.current && modified !== modifiedModelRef.current.getValue()) {
      const editor = editorRef.current?.getModifiedEditor();
      if (editor) {
        const viewState = editor.saveViewState();
        modifiedModelRef.current.setValue(modified);
        if (viewState) {
          editor.restoreViewState(viewState);
        }
        editor.focus();
      }
    }
  }, [modified]);

  useEffect(() => {
    const preferred = rightLang !== 'plaintext' ? rightLang : leftLang;
    const next = langMap[preferred] ?? 'plaintext';
    setStickyLanguage(prev =>
      prev === 'plaintext' ? next : prev // no lo cambies si ya no es plaintext
    );
  }, [leftLang, rightLang]);

  const onMount: DiffOnMount = (editor, monaco) => {
    editorRef.current = editor;
    const originalEditor = editor.getOriginalEditor();
    const modifiedEditor = editor.getModifiedEditor();

    // Create models manually instead of using DiffEditor's built-in models
    originalModelRef.current = monaco.editor.createModel(original, stickyLanguage);
    modifiedModelRef.current = monaco.editor.createModel(modified, stickyLanguage);
    
    // Set our custom models on the editor
    editor.setModel({
      original: originalModelRef.current,
      modified: modifiedModelRef.current
    });

    // ✅ usa el namespace de tipos correcto
    const commonOpts: MonacoEditor.IStandaloneEditorConstructionOptions = {
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      foldingHighlight: true,
      guides: {
        indentation: true,
        highlightActiveIndentation: true,
        bracketPairs: true,
      },
      minimap: { enabled: false },

      lineNumbersMinChars: 2,
      lineDecorationsWidth: 12,

      // sin subrayados/validaciones visuales
      renderValidationDecorations: 'off',
      quickSuggestions: false,

      tabSize: 2,
      insertSpaces: true,
      smoothScrolling: true,
      scrollBeyondLastLine: false,
      wordWrap: 'off',
    };

    originalEditor.updateOptions(commonOpts);
    modifiedEditor.updateOptions(commonOpts);

    // Use debounced callbacks instead of immediate ones
    originalModelRef.current.onDidChangeContent(() => {
      debouncedOriginalChange(originalModelRef.current!.getValue());
    });
    modifiedModelRef.current.onDidChangeContent(() => {
      debouncedModifiedChange(modifiedModelRef.current!.getValue());
    });

    // Limpia markers por si algún worker los hubiese puesto
    monaco.editor.setModelMarkers(originalModelRef.current, 'owner', []);
    monaco.editor.setModelMarkers(modifiedModelRef.current, 'owner', []);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <DiffEditor
      beforeMount={beforeMount}
      onMount={onMount}
      original={""} // Empty strings since we're using manual models
      modified={""} // Empty strings since we're using manual models
      language={stickyLanguage}
      theme="vs-dark"
      height="100%"
      options={{
        renderSideBySide: true,
        automaticLayout: true,
        readOnly: false,
        originalEditable: true,
        ignoreTrimWhitespace: false,
        renderIndicators: true,
        
      }}
    />
  );
}
