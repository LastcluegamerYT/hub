
"use client";

import React, { useEffect, useRef } from "react";
import type { ConsoleMessage } from "@/types";
import { Button } from "./ui/button";
import { ChevronRight, Trash2 } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";

interface ConsolePaneProps {
  messages: ConsoleMessage[];
  onClear: () => void;
  height: number;
}

const messageStyles = {
  log: "text-accent",
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-500 font-semibold",
};

const ConsolePane: React.FC<ConsolePaneProps> = ({ messages, onClear, height }) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  const formatMessage = (msg: any) => {
    if (typeof msg === 'object' && msg !== null) {
      try {
        return JSON.stringify(msg, null, 2);
      } catch {
        return '[unserializable object]';
      }
    }
    return String(msg);
  };

  return (
    <div className="bg-card flex flex-col z-10" style={{ height: `${height}px` }}>
      <div className="flex items-center justify-between p-2 border-t border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Console</h2>
        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear console">
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>
      <ScrollArea className="flex-grow font-code text-sm p-2" ref={scrollAreaRef}>
        {messages.length === 0 ? (
          <div className="flex items-center text-muted-foreground italic h-full justify-center">
            Console output will appear here...
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={cn("flex items-start gap-2 border-b border-border/50 py-1", messageStyles[msg.type])}
            >
              <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-grow whitespace-pre-wrap break-words">
                {msg.message.map(formatMessage).join(" ")}
              </div>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
};

export default ConsolePane;
