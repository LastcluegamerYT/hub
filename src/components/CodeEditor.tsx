
"use client";

import React, { useMemo, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { lintGutter, linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { eclipse } from "@uiw/codemirror-theme-eclipse";
import type { EditorSettings } from "@/types";
import { JSHINT, type LintError } from "jshint";
import { keymap } from "@codemirror/view";
import { Prec } from '@codemirror/state';
import { 
  insertNewlineAndIndent, 
  defaultKeymap, 
  historyKeymap, 
  indentWithTab,
  copyLineDown,
  copyLineUp,
  moveLineDown,
  moveLineUp
} from '@codemirror/commands';
import { autocompletion, closeBrackets, completionKeymap } from "@codemirror/autocomplete";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onLint: (code: string) => void;
  settings: EditorSettings;
}

const jsLinter = linter((view) => {
  // We're adding common browser globals here so JSHint doesn't complain about them.
  const globals = {
    console: false,
    alert: false,
    document: false,
    window: false,
    setTimeout: false,
    setInterval: false,
    clearTimeout: false,
    clearInterval: false,
    fetch: false,
    Promise: false,
    localStorage: false,
    sessionStorage: false,
  };
  JSHINT(view.state.doc.toString(), { esversion: 6, asi: true, expr: true, globals });
  return (JSHINT.errors || []).map((err: LintError) => ({
    from: view.state.doc.line(err.line).from + (err.character || 1) - 1,
    to: view.state.doc.line(err.line).from + (err.character || 1),
    severity: err.code && err.code[0] === 'W' ? 'warning' : 'error',
    message: err.reason || "Unknown error",
  }));
});

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, onRun, onLint, settings }) => {
  useEffect(() => {
    onLint(value);
  }, [value, onLint]);

  const autoSemicolonKeymap = useMemo(() => Prec.high(keymap.of([{
    key: 'Enter',
    run: (view) => {
      if (settings.autoSemicolons) {
        const { state, dispatch } = view;
        const changes = state.changeByRange(range => {
          const pos = range.head;
          const line = state.doc.lineAt(pos);
          const text = line.text.trim();
          
          const noSemicolonRegex = /[\w)\]'"`]$/; // Ends with word char, ), ], ', ", or `
          const noSemicolonBlockEndings = ['{', '(', '[', '=>', ':', '>', ',', ';'];
          const isComment = text.startsWith('//') || text.startsWith('/*');
          const isBlockOpener = /\{\s*$/.test(text);
          const isEmpty = text.length === 0;
          
          const shouldAddSemicolon = 
            !isEmpty &&
            !isComment &&
            !isBlockOpener &&
            noSemicolonRegex.test(text) &&
            !noSemicolonBlockEndings.some(ending => text.endsWith(ending));
          
          if (shouldAddSemicolon) {
            const insertPos = line.to;
            const insert = ';';
            
            // This transaction inserts the semicolon. We'll handle the newline separately.
            const transaction = state.update({
              changes: { from: insertPos, insert },
              selection: { anchor: pos }, // Keep cursor at original position before newline
              userEvent: 'input.complete'
            });

            // Dispatch this change first
            dispatch(transaction);
          }

          // Let the default command for 'Enter' handle the newline.
          return {range: state.selection.ranges[0]}; // a bit of a hack to get the original range back
        });
        
        // Now dispatch the newline command
        return insertNewlineAndIndent(view);
      }
      
      // If auto-semicolons are off, just do the default action.
      return insertNewlineAndIndent(view);
    }
  }])), [settings.autoSemicolons]);


  const extensions = useMemo(() => {
    const commonExtensions = [
      javascript({ 
        jsx: true,
        typescript: false,
        // This provides autocompletion for global browser objects
        globals: (typeof window !== "undefined") ? Object.keys(window) : [],
      }),
      jsLinter,
      lintGutter(),
      EditorView.lineWrapping,
      keymap.of([
        {
          key: "Ctrl-Enter",
          mac: "Cmd-Enter",
          run: () => {
            onRun();
            return true;
          },
        },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...completionKeymap,
        { key: 'Shift-Alt-ArrowDown', run: copyLineDown, preventDefault: true },
        { key: 'Shift-Alt-ArrowUp', run: copyLineUp, preventDefault: true },
        { key: 'Alt-ArrowDown', run: moveLineDown, preventDefault: true },
        { key: 'Alt-ArrowUp', run: moveLineUp, preventDefault: true },
      ]),
      autocompletion(),
      closeBrackets(),
      autoSemicolonKeymap,
    ];

    const dynamicTheme = EditorView.theme({
      '&': {
        fontSize: `${settings.fontSize}px`,
        fontFamily: `var(--font-code)`,
      },
      '.cm-content': {
        fontFamily: `var(--font-code)`,
      },
      '.cm-gutters': {
        fontFamily: `var(--font-code)`,
      },
      '.cm-line': {
        lineHeight: `${settings.lineHeight}`,
      },
      '.cm-cursor': {
        borderLeftWidth: settings.cursorStyle === 'bar' ? '2px' : '0',
        textDecoration: settings.cursorStyle === 'underline' ? 'underline' : 'none',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: settings.theme === 'dark' ? '#f8f8f2' : '#000000',
      },
      '.cm-selectionBackground, & .cm-selectionBackground': {
         backgroundColor: settings.cursorStyle === 'block' ? 'var(--cm-selection-background) !important' : 'default',
      },
       '&.cm-focused .cm-selectionBackground': {
        backgroundColor: settings.cursorStyle === 'block' ? 'var(--cm-selection-background) !important' : 'default',
       },
       '.cm-cursor-primary': {
         backgroundColor: settings.cursorStyle === 'block' ? 'var(--cm-selection-background)' : 'transparent',
         color: settings.cursorStyle === 'block' ? '#fff' : 'default',
       },
    });

    return [...commonExtensions, dynamicTheme];
  }, [settings, onRun, autoSemicolonKeymap]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={settings.theme === "dark" ? dracula : eclipse}
      height="100%"
      style={{ height: "100%", overflow: "auto" }}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        history: true,
        drawSelection: true,
        multipleSelections: true,
      }}
    />
  );
};

export default CodeEditor;
