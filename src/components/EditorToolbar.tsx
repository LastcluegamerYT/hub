
"use client";

import React, { useState, useEffect } from "react";
import type { EditorSettings, Snippet } from "@/types";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Save, Settings, Trash2, Check, ChevronsUpDown } from "lucide-react";

interface EditorToolbarProps {
  settings: EditorSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<EditorSettings>>;
  snippets: Snippet[];
  onSaveSnippet: (name: string) => void;
  onLoadSnippet: (name: string) => void;
  onDeleteSnippet: (name: string) => void;
  activeSnippetName?: string;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  settings,
  onSettingsChange,
  snippets,
  onSaveSnippet,
  onLoadSnippet,
  onDeleteSnippet,
  activeSnippetName
}) => {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [snippetName, setSnippetName] = useState("");

  useEffect(() => {
    if (activeSnippetName) {
      setSnippetName(activeSnippetName);
    }
  }, [activeSnippetName]);

  const handleSave = () => {
    onSaveSnippet(snippetName);
    setIsSaveDialogOpen(false);
  };
  
  const handleDelete = (name: string) => {
    if(window.confirm(`Are you sure you want to delete the snippet "${name}"?`)){
      onDeleteSnippet(name);
    }
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <DropdownMenu>
           <Tooltip>
             <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[180px]">
                    <span className="truncate max-w-[140px]">{activeSnippetName || "Snippets"}</span>
                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
             </TooltipTrigger>
             <TooltipContent>Manage Snippets</TooltipContent>
           </Tooltip>
           <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuItem onSelect={() => setIsSaveDialogOpen(true)}>
                  <Save className="mr-2 h-4 w-4" />
                  <span>Save/Update Snippet</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Load Snippet</DropdownMenuLabel>
              {snippets.length > 0 ? (
                snippets.map(s => (
                  <DropdownMenuSub key={s.name}>
                    <DropdownMenuSubTrigger>{s.name}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onSelect={() => onLoadSnippet(s.name)}>Load</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleDelete(s.name)} className="text-red-500">Delete</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))
              ) : (
                <DropdownMenuItem disabled>No snippets saved</DropdownMenuItem>
              )}
           </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Editor Settings</TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="w-64" align="end">
            <DropdownMenuLabel>Editor Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-2 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="live-run" className="flex-grow">Live Run (Ctrl+L)</Label>
                <Switch id="live-run" checked={settings.liveRun} onCheckedChange={(checked) => onSettingsChange(s => ({ ...s, liveRun: checked }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-semicolon" className="flex-grow">Auto Semicolons</Label>
                <Switch id="auto-semicolon" checked={settings.autoSemicolons} onCheckedChange={(checked) => onSettingsChange(s => ({ ...s, autoSemicolons: checked }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="multi-file" className="flex-grow">Multi-File Tabs</Label>
                <Switch id="multi-file" checked={settings.multiFile} onCheckedChange={(checked) => onSettingsChange(s => ({ ...s, multiFile: checked }))} />
              </div>
              <div className="space-y-2">
                 <Label>Theme</Label>
                 <Select value={settings.theme} onValueChange={(value) => onSettingsChange(s => ({...s, theme: value as 'dark' | 'light'}))}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                         <SelectItem value="dark">Dracula</SelectItem>
                         <SelectItem value="light">Eclipse</SelectItem>
                     </SelectContent>
                 </Select>
              </div>
               <div className="space-y-2">
                 <Label>Cursor Style</Label>
                 <Select value={settings.cursorStyle} onValueChange={(value) => onSettingsChange(s => ({...s, cursorStyle: value as any}))}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                         <SelectItem value="bar">Bar</SelectItem>
                         <SelectItem value="underline">Underline</SelectItem>
                         <SelectItem value="block">Block</SelectItem>
                     </SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-size">Font Size: {settings.fontSize}px</Label>
                <Input id="font-size" type="range" min="10" max="24" step="1" value={settings.fontSize} onChange={(e) => onSettingsChange(s => ({ ...s, fontSize: Number(e.target.value) }))} className="p-0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="line-height">Line Height: {settings.lineHeight}</Label>
                <Input id="line-height" type="range" min="1.2" max="2.2" step="0.1" value={settings.lineHeight} onChange={(e) => onSettingsChange(s => ({ ...s, lineHeight: Number(e.target.value) }))} className="p-0" />
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Snippet</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input
                  id="name"
                  value={snippetName}
                  onChange={(e) => setSnippetName(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., 'My Awesome Function'"
                />
              </div>
              {snippets.some(s => s.name === snippetName && s.name !== activeSnippetName) && (
                <p className="text-sm text-yellow-500 col-span-4 text-center">A snippet with this name already exists. Saving will create a new one.</p>
              )}
               {snippets.some(s => s.name === snippetName && s.name === activeSnippetName) && (
                <p className="text-sm text-yellow-500 col-span-4 text-center">This will overwrite the existing snippet.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default EditorToolbar;
