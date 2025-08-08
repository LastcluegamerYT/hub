
"use client";

import React, { useMemo, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { lintGutter, linter } from "@codemirror/lint";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { eclipse } from "@uiw/codemirror-theme-eclipse";
import type { EditorSettings } from "@/types";
import { JSHINT, type LintError } from "jshint";
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
import { autocompletion, closeBrackets, completionKeymap, ifIn, completeFromList, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";

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

const dynamicCompletions = (context: CompletionContext): CompletionResult | null => {
    let tree = syntaxTree(context.state);
    let word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    let options: { label: string; type: string; }[] = [];
    tree.iterate({
        enter: (node) => {
            if (node.name === "VariableName") {
                const name = context.state.sliceDoc(node.from, node.to);
                if (!options.some(o => o.label === name)) {
                    options.push({ label: name, type: "variable" });
                }
            } else if (node.name === "FunctionDeclaration") {
                const functionNode = node.node;
                const identifier = functionNode.getChild("VariableDefinition");
                if (identifier) {
                    const name = context.state.sliceDoc(identifier.from, identifier.to);
                     if (!options.some(o => o.label === name)) {
                        options.push({ label: `${name}()`, type: "function" });
                    }
                }
            }
        }
    });

    return {
        from: word.from,
        options: options,
        validFor: /^\w*$/
    };
};

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, onRun, onLint, settings, onSave, onToggleLiveRun }) => {
  useEffect(() => {
    onLint(value);
  }, [value, onLint]);

  const autoSemicolonKeymap = useMemo(() => Prec.high(keymap.of([{
    key: 'Enter',
    run: (view) => {
      const { state, dispatch } = view;
      const changes = state.changeByRange(range => {
        const pos = range.head;
        const line = state.doc.lineAt(pos);
        let text = line.text.trim();
        
        // Strip comments from the end of the line
        const commentMatch = text.match(/\s*\/\//);
        if (commentMatch) {
            text = text.substring(0, commentMatch.index).trim();
        }

        const noSemicolonRegex = /[\w)\]'"`]$/;
        const noSemicolonBlockEndings = ['{', '(', '[', ',', ';', ':', '=>'];
        const isBlockOpener = /\{\s*$/.test(text);
        const isEmpty = text.length === 0;

        const shouldAddSemicolon = 
          !isEmpty && !isBlockOpener &&
          noSemicolonRegex.test(text) &&
          !noSemicolonBlockEndings.some(ending => text.endsWith(ending));

        if (shouldAddSemicolon) {
          const insertPos = line.to;
          
          dispatch({
            changes: { from: insertPos, insert: ';' },
            selection: { anchor: pos },
            userEvent: 'input.complete'
          });
        }
        return {range};
      });

      return insertNewlineAndIndent(view);
    }
  }])), [settings.autoSemicolons]);


  const extensions = useMemo(() => {
    const customCompletions = javascriptLanguage.data.of({
        autocomplete: dynamicCompletions,
    });
    
    const globalCompletions = javascriptLanguage.data.of({
        autocomplete: (context: CompletionContext) => {
            return (window as any).completionSources?.(context);
        }
    });

    const commonExtensions = [
      javascript({ 
        jsx: true, 
        typescript: false,
      }),
      customCompletions,
      globalCompletions,
      jsLinter,
      lintGutter(),
      hoverTooltip(linter(jsLinter), {hideOnChange: true}),
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
      Prec.high(keymap.of(defaultKeymap)), // Enables multi-cursor
    ];

    if (settings.autoSemicolons) {
      commonExtensions.push(autoSemicolonKeymap);
    }

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
       }
    });

    return [...commonExtensions, dynamicTheme];
  }, [settings, onRun, onSave, onToggleLiveRun, autoSemicolonKeymap]);

  useEffect(() => {
    // This is a bit of a hack to get global completions working
    if (typeof window !== 'undefined') {
        const propNames = Object.getOwnPropertyNames(window);
        const completions = propNames.map(prop => ({
          label: prop,
          type: typeof (window as any)[prop] === 'function' ? 'function' : 'variable'
        }));
        (window as any).completionSources = completeFromList(completions);
    }
  }, []);

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
        highlightActiveLineGutter: true, autocompletion: false, // handled by extensions
        bracketMatching: true, closeBrackets: false, // handled by extensions
        history: true,
        drawSelection: true, multipleSelections: true,
      }}
    />
  );
};

export default CodeEditor;
