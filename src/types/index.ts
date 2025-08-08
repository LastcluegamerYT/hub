
export type Snippet = {
  name: string;
  code: string;
};

export type ConsoleMessage = {
  type: 'log' | 'warn' | 'error' | 'info';
  message: any[];
  timestamp: string;
};

export type EditorTheme = 'dark' | 'light';
export type CursorStyle = 'bar' | 'underline' | 'block';

export type EditorSettings = {
  theme: EditorTheme;
  fontSize: number;
  lineHeight: number;
  cursorStyle: CursorStyle;
  liveRun: boolean;
  autoSemicolons: boolean;
};
