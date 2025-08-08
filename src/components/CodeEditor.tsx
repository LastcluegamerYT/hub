
"use client";

import React, { useMemo, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { lintGutter, linter } from "@codemirror/lint";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { eclipse } from "@uiw/codemirror-theme-eclipse";
import type { EditorSettings, ActiveFile } from "@/types";
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

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onLint: (code: string) => void;
  settings: EditorSettings;
  onSave: () => void;
  onToggleLiveRun: () => void;
  fileType: ActiveFile['type'];
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

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, onRun, onLint, settings, onSave, onToggleLiveRun, fileType }) => {
  useEffect(() => {
    onLint(value);
  }, [value, onLint]);

  const extensions = useMemo(() => {
    const customAutocomplete = javascriptLanguage.data.of({
      autocomplete: (context: any) => {
        const word = context.matchBefore(/\w*/);
        if (!word || (word.from === word.to && !context.explicit)) return null;

        const tree = syntaxTree(context.state);
        const userCodeGlobals: Record<string, any> = {};
        tree.cursor().iterate(node => {
          if (node.type.name === 'VariableDeclaration') {
             try {
                const declarationText = context.state.doc.sliceString(node.from, node.to);
                const match = declarationText.match(/(?:let|const|var)\s+([^=\s]+)/);
                if (match && match[1]) {
                    userCodeGlobals[match[1]] = 'variable';
                }
             } catch(e) {
                // ignore parsing errors
             }
          }
          if (node.type.name === 'FunctionDeclaration') {
            try {
                const functionDef = node.node.getChild('VariableDefinition');
                if (functionDef) {
                    const name = context.state.doc.sliceString(functionDef.from, functionDef.to);
                    userCodeGlobals[name] = 'function';
                }
            } catch(e) {
                 // ignore parsing errors
            }
          }
        });

        const clientGlobals = typeof window !== 'undefined' ? window : {};
        const allGlobals = { ...userCodeGlobals, ...clientGlobals };

        let options = Object.keys(userCodeGlobals).map(key => ({
            label: key,
            type: userCodeGlobals[key] as 'variable' | 'function'
        }));

        if (typeof window !== 'undefined') {
            const windowOptions = Object.getOwnPropertyNames(clientGlobals)
                .filter(p => {
                    if(p === 'onerror' || p === 'onunhandledrejection') return false;
                    try {
                        return typeof clientGlobals[p as any] === 'function' || typeof clientGlobals[p as any] === 'object'
                    } catch {
                        return false
                    }
                })
                .map(key => ({
                    label: key,
                    type: typeof clientGlobals[key as any] === 'function' ? 'function' : 'variable'
                }));
            options = [...options, ...windowOptions];
        }


        return {
          from: word.from,
          options: options,
        };
      },
    });

    let languageExtension;
    let linterExtensions: any[] = [];
    if (fileType === 'javascript') {
        languageExtension = javascript({ 
            jsx: false, 
            typescript: false, 
            extraExtensions: [customAutocomplete]
        });
        linterExtensions = [jsLinter, lintGutter(), hoverTooltip(jsLinter)];
    } else if (fileType === 'html') {
        languageExtension = html({
             matchClosingTags: true,
             autoCloseTags: true,
        });
    }

    const commonExtensions = [
      languageExtension,
      ...linterExtensions,
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
    ].filter(Boolean);

    const dynamicTheme = EditorView.theme({
      '&': { fontSize: `${settings.fontSize}px`, fontFamily: `var(--font-code)`},
      '.cm-content': { fontFamily: `var(--font-code)` },
      '.cm-gutters': { fontFamily: `var(--font-code)` },
      '.cm-line': { lineHeight: `${settings.lineHeight}` },
      '.cm-cursor, .cm-dropCursor': { borderLeft: `2px solid ${settings.theme === 'dark' ? '#f8f8f2' : '#000000'}` },
      '.cm-selectionBackground, & .cm-selectionBackground, & .cm-content ::selection': { backgroundColor: '#44475a' },
      '&.cm-focused .cm-cursor': { borderLeftColor: settings.theme === 'dark' ? '#f8f8f2' : '#000000' },
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
  }, [settings, onRun, onSave, onToggleLiveRun, value, fileType]);

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
        drawSelection: true,
      }}
    />
  );
};

export default CodeEditor;
