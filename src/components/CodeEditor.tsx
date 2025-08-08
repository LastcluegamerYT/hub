
"use client";

import React, { useMemo, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { lintGutter, linter, getDiagnostics } from "@codemirror/lint";
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
import { autocompletion, closeBrackets, completionKeymap, ifIn, completeFromList } from "@codemirror/autocomplete";
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

const dynamicCompletions = (context: any) => {
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
      if (settings.autoSemicolons) {
        const { state, dispatch } = view;
        const changes = state.changeByRange(range => {
          const pos = range.head;
          const line = state.doc.lineAt(pos);
          const text = line.text.trim();
          
          const noSemicolonRegex = /[\w)\]'"`]$/;
          const noSemicolonBlockEndings = ['{', '(', '[', '=>', ':', '>', ',', ';'];
          const isComment = text.startsWith('//') || text.startsWith('/*');
          const isBlockOpener = /\{\s*$/.test(text);
          const isEmpty = text.length === 0;
          
          const shouldAddSemicolon = 
            !isEmpty && !isComment && !isBlockOpener &&
            noSemicolonRegex.test(text) &&
            !noSemicolonBlockEndings.some(ending => text.endsWith(ending));
          
          if (shouldAddSemicolon) {
            const insertPos = line.to;
            const insert = ';';
            
            const transaction = state.update({
              changes: { from: insertPos, insert },
              selection: { anchor: pos },
              userEvent: 'input.complete'
            });
            dispatch(transaction);
          }
          return {range: state.selection.ranges[0]};
        });
        return insertNewlineAndIndent(view);
      }
      return insertNewlineAndIndent(view);
    }
  }])), [settings.autoSemicolons]);


  const extensions = useMemo(() => {
    const commonExtensions = [
      javascript({ 
        jsx: true, 
        typescript: false,
        completion: dynamicCompletions,
      }),
      jsLinter,
      lintGutter(),
      hoverTooltip((view, pos, side) => {
          const {from, to, text} = view.state.doc.lineAt(pos)
          let start = pos, end = pos
          while (start > from && /\w/.test(text[start - from - 1])) start--
          while (end < to && /\w/.test(text[end - from])) end++
          if (start == pos && side < 0 || end == pos && side > 0) return null
          
          const diagnostics = getDiagnostics(view.state).filter(d => d.from >= from && d.to <= to)
          if (!diagnostics || diagnostics.length === 0) return null
          
          const hoveredDiagnostic = diagnostics.find(d => d.from <= pos && d.to >= pos)
          if(!hoveredDiagnostic) return null;

          return {
              pos: hoveredDiagnostic.from,
              end: hoveredDiagnostic.to,
              above: true,
              create() {
                  let dom = document.createElement("div")
                  dom.className = "cm-tooltip-lint"
                  dom.textContent = hoveredDiagnostic.message
                  return {dom}
              }
          }
      }, {hideOnChange: true}),
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
      autoSemicolonKeymap,
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
       }
    });

    return [...commonExtensions, dynamicTheme];
  }, [settings, onRun, onSave, onToggleLiveRun, autoSemicolonKeymap]);

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
        highlightActiveLineGutter: true, autocompletion: true,
        bracketMatching: true, closeBrackets: true, history: true,
        drawSelection: true, multipleSelections: true,
      }}
    />
  );
};

export default CodeEditor;
