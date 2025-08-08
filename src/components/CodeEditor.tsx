
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
import { insertNewlineAndIndent } from '@codemirror/commands';
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onLint: (code: string) => void;
  settings: EditorSettings;
}

const jsLinter = linter((view) => {
  JSHINT(view.state.doc.toString(), { esversion: 6, asi: true, expr: true });
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
          const noSemicolonBlockEndings = ['{', '(', '[', '=>', ':'];
          const isComment = text.startsWith('//') || text.startsWith('/*');

          const shouldAddSemicolon = text.length > 0 &&
            !text.endsWith(';') &&
            !isComment &&
            noSemicolonRegex.test(text) &&
            !noSemicolonBlockEndings.some(ending => text.endsWith(ending));
          
          if (shouldAddSemicolon) {
            const insertPos = line.to;
            return {
              changes: { from: insertPos, insert: ';' },
              range: range, // keep original range for now
            };
          }
          return { range };
        });

        if (changes.changes.length > 0) {
          dispatch(changes);
        }
      }
      
      return insertNewlineAndIndent(view);
    }
  }])), [settings.autoSemicolons]);


  const extensions = useMemo(() => {
    const commonExtensions = [
      javascript({ jsx: true }),
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
      }}
    />
  );
};

export default CodeEditor;
