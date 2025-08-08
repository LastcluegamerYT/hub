
"use client";

import React, { useMemo, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript, javascriptLanguage, scopeCompletionSource } from "@codemirror/lang-javascript";
import { lintGutter, linter } from "@codemirror/lint";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { eclipse } from "@uiw/codemirror-theme-eclipse";
import type { EditorSettings } from "@/types";
import { JSHINT, type LintError } from "jshint";
import { Prec } from '@codemirror/state';
import { 
  defaultKeymap, 
  historyKeymap, 
  indentWithTab,
  copyLineDown,
  copyLineUp,
  moveLineDown,
  moveLineUp
} from '@codemirror/commands';
import { autocompletion, closeBrackets, completionKeymap } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import {
  autocompletion as jsAutocompletion,
  completionPath,
  ifNotIn,
} from '@codemirror/autocomplete';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onLint: (code: string) => void;
  settings: EditorSettings;
  onSave: () => void;
  onToggleLiveRun: () => void;
}

const jsLinter = linter((view) => {
  const globals = {
    console: false, alert: false, document: false, window: false,
    setTimeout: false, setInterval: false, clearTimeout: false, clearInterval: false,
    fetch: false, Promise: false, localStorage: false, sessionStorage: false,
  };
  JSHINT(view.state.doc.toString(), { esversion: 6, asi: true, expr: true, globals });
  return (JSHINT.errors || []).map((err: LintError) => ({
    from: view.state.doc.line(err.line).from + (err.character || 1) - 1,
    to: view.state.doc.line(err.line).from + (err.character || 1),
    severity: err.code && err.code[0] === 'W' ? 'warning' : 'error',
    message: err.reason || "Unknown error",
  }));
});

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, onRun, onLint, settings, onSave, onToggleLiveRun }) => {
  useEffect(() => {
    onLint(value);
  }, [value, onLint]);

  const extensions = useMemo(() => {
    const customAutocomplete = javascriptLanguage.data.of({
      autocomplete: scopeCompletionSource(javascriptLanguage.scope),
    });

    const commonExtensions = [
      javascript({ 
        jsx: true, 
        typescript: false,
      }),
      customAutocomplete,
      jsLinter,
      lintGutter(),
      hoverTooltip(jsLinter),
      EditorView.lineWrapping,
      keymap.of([
        { key: "Ctrl-Enter", mac: "Cmd-Enter", run: () => { onRun(); return true; }},
        { key: "Ctrl-s", mac: "Cmd-s", run: () => { onSave(); return true; }},
        { key: "Ctrl-l", mac: "Cmd-l", run: () => { onToggleLiveRun(); return true; }},
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
      Prec.high(keymap.of(defaultKeymap)),
    ];

    const dynamicTheme = EditorView.theme({
      '&': { fontSize: `${settings.fontSize}px`, fontFamily: `var(--font-code)`},
      '.cm-content': { fontFamily: `var(--font-code)` },
      '.cm-gutters': { fontFamily: `var(--font-code)` },
      '.cm-line': { lineHeight: `${settings.lineHeight}` },
      '.cm-cursor': { borderLeftWidth: settings.cursorStyle === 'bar' ? '2px' : '0', textDecoration: settings.cursorStyle === 'underline' ? 'underline' : 'none'},
      '&.cm-focused .cm-cursor': { borderLeftColor: settings.theme === 'dark' ? '#f8f8f2' : '#000000' },
      '.cm-selectionBackground, & .cm-selectionBackground': { backgroundColor: settings.cursorStyle === 'block' ? 'var(--cm-selection-background) !important' : 'default' },
       '&.cm-focused .cm-selectionBackground': { backgroundColor: settings.cursorStyle === 'block' ? 'var(--cm-selection-background) !important' : 'default' },
       '.cm-cursor-primary': { backgroundColor: settings.cursorStyle === 'block' ? 'var(--cm-selection-background)' : 'transparent', color: settings.cursorStyle === 'block' ? '#fff' : 'default'},
       '.cm-tooltip-lint': {
          padding: '4px 8px',
          backgroundColor: 'hsl(var(--popover))',
          color: 'hsl(var(--popover-foreground))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          zIndex: '100',
       },
       '.cm-tooltip': {
          backgroundColor: 'hsl(var(--popover))',
          color: 'hsl(var(--popover-foreground))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
       },
       '.cm-completionLabel': {
          fontFamily: `var(--font-code)`
       },
       '.cm-completionDetail': {
          fontFamily: `var(--font-sans)`
       }
    });

    return [...commonExtensions, dynamicTheme];
  }, [settings, onRun, onSave, onToggleLiveRun]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={settings.theme === "dark" ? dracula : eclipse}
      height="100%"
      style={{ height: "100%", overflow: "auto" }}
      basicSetup={{
        lineNumbers: true, foldGutter: true, highlightActiveLine: true,
        highlightActiveLineGutter: true, autocompletion: false,
        bracketMatching: true, closeBrackets: true,
        history: true,
        drawSelection: true, multipleSelections: true,
      }}
    />
  );
};

export default CodeEditor;
