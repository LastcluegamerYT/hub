
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
import { insertNewline } from '@codemirror/commands';
import { closeBrackets } from "@codemirror/autocomplete";

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
        const pos = state.selection.main.head;
        const line = state.doc.lineAt(pos);
        const text = line.text.trim();
        
        const shouldAddSemicolon = text.length > 0 &&
          !text.endsWith(';') &&
          !text.endsWith('{') &&
          !text.endsWith('}') &&
          !text.endsWith('(') &&
          !text.endsWith(')') &&
          !text.endsWith('[') &&
          !text.endsWith(']') &&
          !text.startsWith('//') &&
          !text.startsWith('/*') &&
          !text.endsWith(':') &&
          !text.endsWith('=>');

        if (shouldAddSemicolon) {
          dispatch({
            changes: { from: line.to, insert: ';' },
            selection: { anchor: pos, head: pos } // Keep cursor position before inserting newline
          });
        }
      }
      // Always run insertNewline, but after semicolon logic if enabled
      return insertNewline(view);
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
      autoSemicolonKeymap,
      closeBrackets(),
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
        backgroundColor: settings.cursorStyle === 'block' ? 'var(--cm-selection-background)' : 'transparent',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--cm-active-line-background)'
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
