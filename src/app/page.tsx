
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Snippet, ConsoleMessage, EditorSettings, ActiveFile } from "@/types";
import { Code, Play, FileCode, Cloud, CloudOff, Plus, X } from "lucide-react";
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


const defaultJsCode = `// Welcome to Project Void!
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
    <title>Project Void Output</title>
    <style>
        body { font-family: sans-serif; background-color: #282A36; color: #f8f8f2; padding: 1rem; }
    </style>
</head>
<body>
    <h1>Hello from Project Void!</h1>
    <p>Your JavaScript output will appear in the browser's console (Press F12 to open).</p>
    <!-- Your open JavaScript files will be automatically included here -->
</body>
</html>
`;


const defaultJsFileName = "main.js";
const defaultHtmlFileName = "index.html";

export default function Home() {
  const [userId, setUserId] = useLocalStorage<string | null>('void-user-id', null);
  const [isFirebaseSynced, setIsFirebaseSynced] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const [activeFiles, setActiveFiles] = useState<ActiveFile[]>(() => [
      { id: defaultHtmlFileName, name: defaultHtmlFileName, code: defaultHtmlCode, type: 'html', isSaved: true },
      { id: defaultJsFileName, name: defaultJsFileName, code: defaultJsCode, type: 'javascript', isSaved: true }
  ]);
  const [activeFileId, setActiveFileId] = useState<string>(defaultHtmlFileName);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [lintErrors, setLintErrors] = useState<any[]>([]);
  const [consoleHeight, setConsoleHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<ActiveFile | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const { toast } = useToast();

  const firebaseDataLoadedRef = useRef(false);
  const isLocalUpdateRef = useRef(false);
  
  useEffect(() => {
    setIsClient(true);
    if (!userId) {
      setUserId(`user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    }
  }, [setUserId, userId]);

  const [settings, setSettings] = useLocalStorage<EditorSettings>("void-editor-settings", {
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
  const debouncedCode = useDebounce(code, 500);

  const saveStateToFirebase = useCallback(() => {
    if (!userId || !isDataLoaded) return;

    isLocalUpdateRef.current = true;
    setIsFirebaseSynced(false);

    const userRef = ref(database, `users/${userId}`);
    const dataToSync = {
      activeFiles,
      snippets,
      settings,
      activeFileId,
    };
    
    set(userRef, dataToSync)
      .then(() => {
        setIsFirebaseSynced(true);
        toast({ title: "Synced!", description: "Your changes have been saved to the cloud." });
      })
      .catch(error => {
          console.error("Firebase write failed: ", error);
          toast({ title: "Sync Error", description: "Failed to save changes to the cloud.", variant: 'destructive'});
      })
      .finally(() => {
          setTimeout(() => {
              isLocalUpdateRef.current = false;
          }, 100); 
      });
  }, [userId, activeFiles, snippets, settings, activeFileId, toast, isDataLoaded]);

  useEffect(() => {
    if (!userId || !isClient) return;

    const userRef = ref(database, `users/${userId}`);
    const loadInitialData = async () => {
      if (firebaseDataLoadedRef.current) return;
      firebaseDataLoadedRef.current = true;
  
      try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          isLocalUpdateRef.current = true;
          if (data.activeFiles) setActiveFiles(data.activeFiles);
          if (data.activeFileId) setActiveFileId(data.activeFileId);
          if (data.snippets) setSnippets(data.snippets);
          if (data.settings) setSettings(data.settings);
          toast({ title: "Data Synced", description: "Your data has been loaded from the cloud." });
        } else {
           // New user or no data, push initial local state to Firebase
           saveStateToFirebase();
        }
      } catch (error) {
        console.error("Firebase read failed:", error);
        toast({ title: "Sync Error", description: "Could not load data from the cloud.", variant: 'destructive'});
      } finally {
        setIsDataLoaded(true);
        setIsFirebaseSynced(true);
        setTimeout(() => { isLocalUpdateRef.current = false; }, 100);
      }
    };
  
    if (!firebaseDataLoadedRef.current) {
      loadInitialData();
    }
  
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (isLocalUpdateRef.current || !firebaseDataLoadedRef.current) {
        return;
      }
      if (snapshot.exists()) {
        console.log("Data updated from another source.");
        const data = snapshot.val();
        if (data.activeFiles) setActiveFiles(data.activeFiles);
        if (data.activeFileId) setActiveFileId(data.activeFileId);
        if (data.snippets) setSnippets(data.snippets);
        if (data.settings) setSettings(data.settings);
        toast({ title: "Data Updated", description: "Your session has been updated from another source." });
      }
    });

    return () => unsubscribe();
  }, [userId, isClient, setSettings, toast, saveStateToFirebase]);


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
        const scriptTags = jsFiles.map(f => `<script>\\n// ${f.name}\\n${f.code}\\n</script>`).join('\\n');
        
        const finalHtml = code.replace('</body>', `${scriptTags}\\n</body>`);

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
      saveStateToFirebase();
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
    // Note: This change won't be synced until the next save.
  };
  
  const handleCloseTab = (tabId: string) => {
    const fileToClose = activeFiles.find(f => f.id === tabId);
    if (fileToClose && !fileToClose.isSaved) {
       if (!window.confirm(`You have unsaved changes in "${fileToClose.name}". Are you sure you want to close it?`)) {
         return;
       }
    }

    let newFiles = activeFiles.filter(f => f.id !== tabId);
    if (newFiles.length === 0) {
       newFiles = [{ id: defaultJsFileName, name: defaultJsFileName, code: defaultJsCode, type: 'javascript', isSaved: true }];
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
    toast({ title: "File Renamed", description: `Renamed to "${newFileName}". Your changes will be synced on next save.`});
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
        <div className="flex h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Code className="h-12 w-12 text-primary animate-pulse" />
                <p className="text-lg text-muted-foreground">Loading Project Void...</p>
            </div>
        </div>
    );
  }

  const runButtonDisabled = activeFile?.type === 'javascript' && lintErrors.length > 0;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-2 border-b border-border shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Code className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Project Void (Early Access)</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <TooltipProvider>
             <Tooltip>
                <TooltipTrigger>
                    {isFirebaseSynced ? <Cloud className="h-5 w-5 text-green-500" /> : <CloudOff className="h-5 w-5 text-red-500" />}
                </TooltipTrigger>
                <TooltipContent>
                    {isFirebaseSynced ? "Your work is saved to the cloud." : "Could not connect to sync service."}
                </TooltipContent>
             </Tooltip>
           </TooltipProvider>

           <EditorToolbar
            settings={settings}
            onSettingsChange={setSettings}
            snippets={snippets}
            onSaveSnippet={handleSaveSnippet}
            onLoadSnippet={handleLoadSnippet}
            onDeleteSnippet={handleDeleteSnippet}
            activeSnippetName={activeFile?.isSaved ? activeFile.name : undefined}
          />
          <Button onClick={runCode} disabled={runButtonDisabled}>
            <Play className="mr-2 h-4 w-4" />
            Run
          </Button>
        </div>
      </header>
      <div className="flex-grow flex flex-col min-h-0">
        {isClient && settings.multiFile && (
           <div className="flex border-b border-border bg-card">
            {activeFiles.map(file => (
                <TooltipProvider key={file.id}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                onClick={() => setActiveFileId(file.id)}
                                onDoubleClick={() => openRenameDialog(file)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 border-r border-border cursor-pointer transition-colors",
                                    activeFileId === file.id ? "bg-background text-primary" : "hover:bg-accent/10"
                                )}
                            >
                                {file.type === 'javascript' ? <FileCode className="h-4 w-4 text-yellow-500" /> : <FileCode className="h-4 w-4 text-blue-400" />}
                                {file.name}{!file.isSaved && '*'}
                                <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={(e) => {e.stopPropagation(); handleCloseTab(file.id)}}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            Double-click to rename
                        </TooltipContent>
                    </Tooltip>
              </TooltipProvider>
            ))}
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="m-1" onClick={() => handleAddNewFile('javascript')}><Plus className="h-4 w-4" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>New JS File</TooltipContent>
                </Tooltip>
             </TooltipProvider>
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" className="m-1" onClick={() => handleAddNewFile('html')}><Plus className="h-4 w-4" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>New HTML File</TooltipContent>
                </Tooltip>
             </TooltipProvider>
          </div>
        )}
        <div className="flex-grow relative" style={{ height: `calc(100% - ${consoleHeight}px)` }}>
            <CodeEditor
                value={code}
                onChange={setCode}
                onRun={runCode}
                onLint={handleLint}
                settings={settings}
                onSave={() => handleSaveSnippet(activeFile.name)}
                onToggleLiveRun={() => setSettings(s => ({...s, liveRun: !s.liveRun}))}
                fileType={activeFile.type}
            />
        </div>
        <div onMouseDown={handleMouseDown} className="cursor-row-resize h-2 bg-border hover:bg-primary transition-colors">
        </div>
        <div className="relative">
          <ConsolePane messages={messages} onClear={clearMessages} height={consoleHeight} />
        </div>
      </div>
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
                    <Label htmlFor="new-name" className="text-right">
                        Name
                    </Label>
                    <Input
                        id="new-name"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="col-span-3"
                        placeholder="Enter new file name"
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleRename}>Rename</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    