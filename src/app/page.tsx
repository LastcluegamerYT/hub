
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Snippet, ConsoleMessage, EditorSettings, ActiveFile } from "@/types";
import { Code, Play, Save, Trash2, X, Plus, FilePenLine, FileCode, Cloud, CloudOff } from "lucide-react";
import CodeEditor from "@/components/CodeEditor";
import ConsolePane from "@/components/ConsolePane";
import EditorToolbar from "@/components/EditorToolbar";
import { JSHINT } from "jshint";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { database } from "@/lib/firebase";
import { ref, onValue, set, get } from "firebase/database";


const defaultJsCode = `// Welcome to CodeRunner.js!
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

const defaultHtmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeRunner Output</title>
    <style>
        body { font-family: sans-serif; background-color: #282A36; color: #f8f8f2; padding: 1rem; }
    </style>
</head>
<body>
    <h1>Hello from CodeRunner.js!</h1>
    <p>Your JavaScript output will appear in the browser's console (Press F12 to open).</p>
    <!-- Your open JavaScript files will be automatically included here -->
</body>
</html>
`;


const defaultJsFileName = "main.js";
const defaultHtmlFileName = "index.html";

export default function Home() {
  const [userId, setUserId] = useLocalStorage<string | null>('coderunner-user-id', null);
  const [isFirebaseSynced, setIsFirebaseSynced] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [activeFiles, setActiveFiles] = useLocalStorage<ActiveFile[]>("active-files", () => [
      { id: defaultHtmlFileName, name: defaultHtmlFileName, code: defaultHtmlCode, type: 'html', isSaved: true },
      { id: defaultJsFileName, name: defaultJsFileName, code: defaultJsCode, type: 'javascript', isSaved: true }
  ]);
  const [activeFileId, setActiveFileId] = useLocalStorage<string>("active-file-id", defaultHtmlFileName);
  const [snippets, setSnippets] = useLocalStorage<Snippet[]>("snippets", []);
  
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [lintErrors, setLintErrors] = useState<any[]>([]);
  const [consoleHeight, setConsoleHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<ActiveFile | null>(null);
  const [newFileName, setNewFileName] = useState("");

  const dataInitializedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
    if (!userId) {
      setUserId(`user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    }
  }, []);

  const [settings, setSettings] = useLocalStorage<EditorSettings>("editor-settings", {
    theme: "dark",
    fontSize: 14,
    lineHeight: 1.6,
    cursorStyle: "bar",
    liveRun: false,
    autoSemicolons: true,
    multiFile: true,
  });

  const activeFile = activeFiles.find(f => f.id === activeFileId) || activeFiles[0];
  const code = activeFile?.code ?? '';

  const debouncedActiveFiles = useDebounce(activeFiles, 1000);
  const debouncedSnippets = useDebounce(snippets, 1000);
  const debouncedSettings = useDebounce(settings, 1000);
  const debouncedActiveFileId = useDebounce(activeFileId, 1000);


  // Firebase Integration
  useEffect(() => {
    if (userId) {
      const userRef = ref(database, `users/${userId}`);

      const loadDataFromFirebase = async () => {
        try {
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.activeFiles) setActiveFiles(data.activeFiles);
            if (data.activeFileId) setActiveFileId(data.activeFileId);
            if (data.snippets) setSnippets(data.snippets);
            if (data.settings) setSettings(data.settings);
            toast({ title: "Data Synced", description: "Your data has been loaded from the cloud." });
          } else {
             // New user, push initial local storage state to Firebase
             set(userRef, {
                activeFiles,
                activeFileId,
                snippets,
                settings
             });
          }
        } catch (error) {
          console.error("Firebase read failed:", error);
          toast({ title: "Sync Error", description: "Could not load data from the cloud.", variant: 'destructive'});
        } finally {
            setIsDataLoaded(true);
            setIsFirebaseSynced(true);
        }
      };

      loadDataFromFirebase();
      
      const unsubscribe = onValue(userRef, (snapshot) => {
        if (snapshot.exists() && dataInitializedRef.current) {
            // Data updated from another client, we can reflect changes here if needed
            // For now, we mainly focus on pushing changes out.
        }
        dataInitializedRef.current = true;
      });

      return () => unsubscribe();
    } else {
        setIsDataLoaded(true); // No user ID, so we consider data "loaded" from local
    }
  }, [userId]);


  // Effect to write to Firebase
  useEffect(() => {
    if (userId && isFirebaseSynced && isDataLoaded) {
      const userRef = ref(database, `users/${userId}`);
      const dataToSync = {
        activeFiles: debouncedActiveFiles,
        snippets: debouncedSnippets,
        settings: debouncedSettings,
        activeFileId: debouncedActiveFileId,
      };
      set(userRef, dataToSync).catch(error => {
          console.error("Firebase write failed: ", error);
          toast({ title: "Sync Error", description: "Failed to save changes to the cloud.", variant: 'destructive'});
      });
    }
  }, [debouncedActiveFiles, debouncedSnippets, debouncedSettings, debouncedActiveFileId, userId, isFirebaseSynced, isDataLoaded]);


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
    if (!activeFile) return;
    if (activeFile.type === 'javascript') {
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
    } else if (activeFile.type === 'html') {
        const jsFiles = activeFiles.filter(f => f.type === 'javascript');
        const scriptTags = jsFiles.map(f => `<script>\n// ${f.name}\n${f.code}\n</script>`).join('\n');
        
        const finalHtml = code.replace('</body>', `${scriptTags}\n</body>`);

        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(finalHtml);
          newWindow.document.close();
          toast({ title: "HTML Rendered", description: "Output displayed in new tab." });
        } else {
          toast({ title: "Error", description: "Could not open new window. Please disable your pop-up blocker.", variant: "destructive" });
        }
    }
  }, [code, lintErrors, addMessage, clearMessages, toast, activeFile, activeFiles]);

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
    if (settings.liveRun && debouncedCode && activeFile?.type === 'javascript') {
      runCode();
    }
  }, [debouncedCode, settings.liveRun, runCode, activeFile]);

  const handleLint = useCallback((editorCode: string) => {
    if (activeFile?.type === 'javascript') {
        JSHINT(editorCode, { esversion: 6, asi: true, expr: true });
        setLintErrors(JSHINT.errors || []);
    } else {
        setLintErrors([]);
    }
  }, [activeFile]);

  const handleSaveSnippet = (name: string) => {
    if (name && activeFile) {
      const newSnippet: Snippet = { name, code, type: activeFile.type };
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
      if (activeFileId === defaultJsFileName || activeFileId === defaultHtmlFileName) {
        setActiveFileId(name);
      }
    }
  };
  
  const handleLoadSnippet = (name: string) => {
    const snippet = snippets.find((s) => s.name === name);
    if (snippet) {
      const fileId = snippet.name;
      if (!activeFiles.some(f => f.id === fileId)) {
        setActiveFiles([...activeFiles, { id: fileId, name: snippet.name, code: snippet.code, type: snippet.type, isSaved: true }]);
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
       newFiles.push({ id: defaultJsFileName, name: defaultJsFileName, code: defaultJsCode, type: 'javascript', isSaved: true });
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

  const handleAddNewFile = (type: 'javascript' | 'html') => {
      const extension = type === 'javascript' ? '.js' : '.html';
      const baseName = type === 'javascript' ? 'untitled' : 'index';
      const defaultContent = type === 'javascript' ? `// new file` : defaultHtmlCode;

      if (type === 'html' && activeFiles.some(f => f.type === 'html')) {
          toast({ title: "File exists", description: "Only one HTML file is allowed at the moment.", variant: "destructive"});
          return;
      }

      let newFileName = `${baseName}${extension}`;
      let counter = 1;
      while (activeFiles.some(f => f.name === newFileName)) {
        newFileName = `${baseName}-${counter}${extension}`;
        counter++;
      }
      
      const newFileId = `${baseName}-${Date.now()}${extension}`;

      const newFile: ActiveFile = {
        id: newFileId,
        name: newFileName,
        code: defaultContent,
        type: type,
        isSaved: false
      };

      setActiveFiles([...activeFiles, newFile]);
      setActiveFileId(newFileId);
  };


  const handleRename = () => {
    if (!fileToRename || !newFileName) return;
    if (newFileName !== fileToRename.name && activeFiles.some(f => f.name === newFileName)) {
      toast({
        title: "Rename Failed",
        description: "A file with that name already exists.",
        variant: "destructive"
      });
      return;
    }
    
    // Also update snippet name if it exists
    const snippetExists = snippets.some(s => s.name === fileToRename.name);
    if (snippetExists) {
        const newSnippets = snippets.map(s => s.name === fileToRename.name ? {...s, name: newFileName} : s);
        setSnippets(newSnippets);
    }

    setActiveFiles(files => files.map(f => f.id === fileToRename.id ? { ...f, name: newFileName, id: newFileName, isSaved: snippetExists } : f));
    setActiveFileId(newFileName);
    setIsRenameDialogOpen(false);
    setFileToRename(null);
    toast({ title: "File Renamed", description: `Renamed to "${newFileName}".`});
  };

  const openRenameDialog = (file: ActiveFile) => {
    setFileToRename(file);
    setNewFileName(file.name);
    setIsRenameDialogOpen(true);
  };

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

  if (!isClient || !isDataLoaded) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
            <div className="flex flex-col items-center gap-4">
                <Code className="h-16 w-16 animate-pulse text-primary" />
                <p className="text-lg text-muted-foreground">Loading CodeRunner.js...</p>
            </div>
        </div>
    );
  }

  const runButtonDisabled = activeFile?.type === 'javascript' && lintErrors.length > 0;

  return (
    <TooltipProvider>
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      <header className="flex items-center justify-between p-2 border-b border-border shadow-md z-20">
        <div className="flex items-center gap-3">
          <Code className="text-primary h-8 w-8" />
          <h1 className="text-xl font-bold font-headline text-foreground">CodeRunner.js</h1>
        </div>
        <div className="flex items-center gap-2">
           <Tooltip>
             <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isFirebaseSynced ? <Cloud className="h-5 w-5 text-green-500" /> : <CloudOff className="h-5 w-5 text-red-500" />}
                    <span>{isFirebaseSynced ? "Synced" : "Offline"}</span>
                </div>
             </TooltipTrigger>
             <TooltipContent>
                <p>{isFirebaseSynced ? "Your work is saved to the cloud." : "Could not connect to sync service."}</p>
             </TooltipContent>
           </Tooltip>

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
            disabled={runButtonDisabled}
            title={runButtonDisabled ? "Fix lint errors to run" : "Run Code (Ctrl+Enter)"}
          >
            <Play size={16} />
            Run
          </button>
        </div>
      </header>
      <main className="flex-grow flex flex-col overflow-hidden">
        {settings.multiFile && isClient && (
           <div className="flex items-center border-b border-border bg-card">
            {activeFiles.map(file => (
              <div 
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                onDoubleClick={() => openRenameDialog(file)}
                className={cn(
                  "flex items-center gap-2 pl-4 pr-2 py-2 border-r border-border cursor-pointer text-sm",
                  activeFileId === file.id ? "bg-background text-primary" : "text-muted-foreground hover:bg-background/50"
                )}
                title={file.name}
              >
                {file.type === 'javascript' ? <Code size={14} /> : <FileCode size={14} />}
                <span className="truncate max-w-32">{file.name}{!file.isSaved && '*'}</span>
                
                <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={(e) => { e.stopPropagation(); handleCloseTab(file.id); }}>
                    <X size={14} />
                </Button>
              </div>
            ))}
             <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="ml-2 h-7 w-7" onClick={() => handleAddNewFile('javascript')}>
                        <Plus size={16} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>New JS File</p>
                </TooltipContent>
            </Tooltip>
             <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAddNewFile('html')}>
                        <FileCode size={16} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>New HTML File</p>
                </TooltipContent>
            </Tooltip>
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
            fileType={activeFile?.type ?? 'javascript'}
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
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Rename File</DialogTitle>
                <DialogDescription>
                    Enter a new name for the file. If this file is a saved snippet, the snippet will be renamed as well.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input
                        id="name"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="col-span-3"
                        placeholder="Enter new file name"
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button type="submit" onClick={handleRename}>Rename</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </div>
    </TooltipProvider>
  );
}
