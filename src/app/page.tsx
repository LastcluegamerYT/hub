
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Snippet, ConsoleMessage, EditorSettings } from "@/types";
import { Code, Play, Save, Trash2, XCircle } from "lucide-react";
import CodeEditor from "@/components/CodeEditor";
import ConsolePane from "@/components/ConsolePane";
import EditorToolbar from "@/components/EditorToolbar";
import { JSHINT } from "jshint";
import { useToast } from "@/hooks/use-toast";


const defaultCode = `// Welcome to CodeRunner.js!
// You can write and run your JavaScript code here.
// Try changing this message and hitting the 'Run' button.

function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('Developer'));

// You can also see warnings and errors.
// Try uncommenting the lines below.

// console.warn("This is a warning message.");
// console.error("This is an error message.");
// undeclaredVariable = true; // This will cause a linting error and a runtime error.
`;

export default function Home() {
  const [code, setCode] = useState<string>(defaultCode);
  const [snippets, setSnippets] = useLocalStorage<Snippet[]>("snippets", []);
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [lintErrors, setLintErrors] = useState<any[]>([]);
  const [consoleHeight, setConsoleHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const { toast } = useToast();

  const [settings, setSettings] = useLocalStorage<EditorSettings>("editor-settings", {
    theme: "dark",
    fontSize: 14,
    lineHeight: 1.6,
    cursorStyle: "bar",
    liveRun: false,
    autoSemicolons: true,
  });

  const debouncedCode = useDebounce(code, 750);

  const clearMessages = useCallback(() => setMessages([]), []);

  const addMessage = useCallback((type: ConsoleMessage['type'], ...args: any[]) => {
    setMessages((prev) => [
      ...prev,
      {
        type,
        message: args,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);
  
  const runCode = useCallback(() => {
    if (lintErrors.length > 0) {
      addMessage("error", "Cannot run code with linting errors. Please fix them first.");
      toast({
        title: "Linting Error",
        description: "Cannot run code with linting errors. Please fix them first.",
        variant: "destructive"
      });
      return;
    }
    clearMessages();
    try {
      // eslint-disable-next-line no-new-func
      const func = new Function('console', code);
      func(window.console);
    } catch (error: any) {
      addMessage("error", error.toString());
    }
  }, [code, lintErrors, addMessage, clearMessages, toast]);

  useEffect(() => {
    const originalConsole = { ...window.console };
    const newConsole = {
      log: (...args: any[]) => {
        addMessage("log", ...args);
        originalConsole.log(...args);
      },
      warn: (...args: any[]) => {
        addMessage("warn", ...args);
        originalConsole.warn(...args);
      },
      error: (...args: any[]) => {
        addMessage("error", ...args);
        originalConsole.error(...args);
      },
      info: (...args: any[]) => {
        addMessage("info", ...args);
        originalConsole.info(...args);
      },
    };

    window.console = { ...window.console, ...newConsole };
    return () => {
      window.console = originalConsole;
    };
  }, [addMessage]);

  useEffect(() => {
    if (settings.liveRun && debouncedCode) {
      runCode();
    }
  }, [debouncedCode, settings.liveRun, runCode]);

  const handleLint = useCallback((editorCode: string) => {
    // The 'esversion: 6' option enables support for ES6 syntax.
    // 'asi: true' allows for automatic semicolon insertion (prevents some lint errors).
    // 'expr: true' allows expressions where statements are expected.
    JSHINT(editorCode, { esversion: 6, asi: true, expr: true });
    setLintErrors(JSHINT.errors || []);
  }, []);

  const handleSaveSnippet = (name: string) => {
    if (name && !snippets.find((s) => s.name === name)) {
      setSnippets([...snippets, { name, code }]);
      toast({ title: "Snippet Saved", description: `Snippet "${name}" has been saved.`});
    } else if (name) {
      // Overwrite existing snippet
      setSnippets(snippets.map(s => s.name === name ? { name, code } : s));
      toast({ title: "Snippet Overwritten", description: `Snippet "${name}" has been updated.`});
    }
  };

  const handleLoadSnippet = (name: string) => {
    const snippet = snippets.find((s) => s.name === name);
    if (snippet) {
      setCode(snippet.code);
      toast({ title: "Snippet Loaded", description: `Loaded snippet "${name}".`});
    }
  };

  const handleDeleteSnippet = (name: string) => {
    setSnippets(snippets.filter((s) => s.name !== name));
    toast({ title: "Snippet Deleted", description: `Snippet "${name}" has been deleted.`, variant: "destructive" });
  };
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight >= 100 && newHeight <= window.innerHeight - 200) {
        setConsoleHeight(newHeight);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if(isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      <header className="flex items-center justify-between p-2 border-b border-border shadow-md z-20">
        <div className="flex items-center gap-3">
          <Code className="text-primary h-8 w-8" />
          <h1 className="text-xl font-bold font-headline text-foreground">CodeRunner.js</h1>
        </div>
        <div className="flex items-center gap-2">
           <EditorToolbar
            settings={settings}
            onSettingsChange={setSettings}
            snippets={snippets}
            onSaveSnippet={handleSaveSnippet}
            onLoadSnippet={handleLoadSnippet}
            onDeleteSnippet={handleDeleteSnippet}
          />
          <button
            onClick={runCode}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
            disabled={lintErrors.length > 0}
            title={lintErrors.length > 0 ? "Fix lint errors to run" : "Run Code (Ctrl+Enter)"}
          >
            <Play size={16} />
            Run
          </button>
        </div>
      </header>
      <main className="flex-grow flex flex-col overflow-hidden">
        <div className="flex-grow relative" style={{ height: `calc(100% - ${consoleHeight}px)`}}>
          <CodeEditor
            value={code}
            onChange={setCode}
            onRun={runCode}
            onLint={handleLint}
            settings={settings}
          />
        </div>
        <div 
          onMouseDown={handleMouseDown}
          className="w-full h-2 bg-border cursor-row-resize hover:bg-primary/50 transition-colors z-10"
          title="Drag to resize console"
        />
        <ConsolePane 
          messages={messages} 
          onClear={clearMessages} 
          height={consoleHeight}
        />
      </main>
    </div>
  );
}
