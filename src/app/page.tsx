
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Snippet, ConsoleMessage, EditorSettings, ActiveFile } from "@/types";
import { Code, Play, Save, Trash2, X } from "lucide-react";
import CodeEditor from "@/components/CodeEditor";
import ConsolePane from "@/components/ConsolePane";
import EditorToolbar from "@/components/EditorToolbar";
import { JSHINT } from "jshint";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

const defaultFileName = "scratchpad.js";

export default function Home() {
  const [activeFiles, setActiveFiles] = useLocalStorage<ActiveFile[]>("active-files", [{ id: defaultFileName, name: defaultFileName, code: defaultCode, isSaved: true }]);
  const [activeFileId, setActiveFileId] = useLocalStorage<string>("active-file-id", defaultFileName);
  const [snippets, setSnippets] = useLocalStorage<Snippet[]>("snippets", []);
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [lintErrors, setLintErrors] = useState<any[]>([]);
  const [consoleHeight, setConsoleHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const [settings, setSettings] = useLocalStorage<EditorSettings>("editor-settings", {
    theme: "dark",
    fontSize: 14,
    lineHeight: 1.6,
    cursorStyle: "bar",
    liveRun: false,
    autoSemicolons: true,
    multiFile: false,
  });

  const activeFile = activeFiles.find(f => f.id === activeFileId) || activeFiles[0];
  const code = activeFile?.code ?? defaultCode;

  const debouncedCode = useDebounce(code, 750);

  const setCode = (newCode: string) => {
    setActiveFiles(files => files.map(f => f.id === activeFileId ? { ...f, code: newCode, isSaved: snippets.some(s => s.name === f.name && s.code === newCode) } : f));
  };

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
      log: (...args: any[]) => addMessage("log", ...args),
      warn: (...args: any[]) => addMessage("warn", ...args),
      error: (...args: any[]) => addMessage("error", ...args),
      info: (...args: any[]) => addMessage("info", ...args),
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
    JSHINT(editorCode, { esversion: 6, asi: true, expr: true });
    setLintErrors(JSHINT.errors || []);
  }, []);

  const handleSaveSnippet = (name: string) => {
    if (name) {
      const newSnippet = { name, code };
      const existingIndex = snippets.findIndex(s => s.name === name);
      if (existingIndex !== -1) {
        const newSnippets = [...snippets];
        newSnippets[existingIndex] = newSnippet;
        setSnippets(newSnippets);
        toast({ title: "Snippet Overwritten", description: `Snippet "${name}" has been updated.`});
      } else {
        setSnippets([...snippets, newSnippet]);
        toast({ title: "Snippet Saved", description: `Snippet "${name}" has been saved.`});
      }
      setActiveFiles(files => files.map(f => f.id === activeFileId ? { ...f, name, isSaved: true } : f));
      if (activeFileId === defaultFileName) {
        setActiveFileId(name);
      }
    }
  };
  
  const handleLoadSnippet = (name: string) => {
    const snippet = snippets.find((s) => s.name === name);
    if (snippet) {
      const fileId = snippet.name;
      if (!activeFiles.some(f => f.id === fileId)) {
        setActiveFiles([...activeFiles, { id: fileId, name: snippet.name, code: snippet.code, isSaved: true }]);
      }
      setActiveFileId(fileId);
      toast({ title: "Snippet Loaded", description: `Loaded snippet "${name}".`});
    }
  };

  const handleDeleteSnippet = (name: string) => {
    setSnippets(snippets.filter((s) => s.name !== name));
    if (activeFiles.some(f => f.id === name)) {
      handleCloseTab(name);
    }
    toast({ title: "Snippet Deleted", description: `Snippet "${name}" has been deleted.`, variant: "destructive" });
  };
  
  const handleCloseTab = (tabId: string) => {
    const fileToClose = activeFiles.find(f => f.id === tabId);
    if (fileToClose && !fileToClose.isSaved) {
       if (!window.confirm(`You have unsaved changes in "${fileToClose.name}". Are you sure you want to close it?`)) {
         return;
       }
    }

    const newFiles = activeFiles.filter(f => f.id !== tabId);
    if (newFiles.length === 0) {
      newFiles.push({ id: defaultFileName, name: defaultFileName, code: defaultCode, isSaved: true });
    }

    if (activeFileId === tabId) {
      setActiveFileId(newFiles[0].id);
    }
    setActiveFiles(newFiles);
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

  if (!isClient) {
    return null;
  }

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
            activeSnippetName={activeFile?.name}
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
        {settings.multiFile && (
           <div className="flex border-b border-border bg-card">
            {activeFiles.map(file => (
              <div 
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border-r border-border cursor-pointer text-sm",
                  activeFileId === file.id ? "bg-background text-primary" : "text-muted-foreground hover:bg-background/50"
                )}
              >
                <span>{file.name}{!file.isSaved && '*'}</span>
                {activeFiles.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={(e) => { e.stopPropagation(); handleCloseTab(file.id); }}>
                    <X size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex-grow relative" style={{ height: `calc(100% - ${consoleHeight}px)`}}>
          <CodeEditor
            value={code}
            onChange={setCode}
            onRun={runCode}
            onLint={handleLint}
            settings={settings}
            onSave={() => handleSaveSnippet(activeFile.name)}
            onToggleLiveRun={() => setSettings(s => ({...s, liveRun: !s.liveRun}))}
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
