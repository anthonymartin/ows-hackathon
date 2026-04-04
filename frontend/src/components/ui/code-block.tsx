"use client";

import { clsx } from "clsx";

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
  inline?: boolean;
}

// --- Trigger DSL highlighter ---
function highlightDSL(code: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let i = 0;

  while (i < code.length) {
    // Whitespace
    if (/\s/.test(code[i])) {
      let ws = "";
      while (i < code.length && /\s/.test(code[i])) ws += code[i++];
      tokens.push(ws);
      continue;
    }

    // Single-quoted strings
    if (code[i] === "'") {
      let str = "'";
      i++;
      while (i < code.length && code[i] !== "'") str += code[i++];
      if (i < code.length) str += code[i++];
      tokens.push(<span key={tokens.length} className="text-[#9ECE6A]">{str}</span>);
      continue;
    }

    // Parentheses
    if (code[i] === "(" || code[i] === ")") {
      tokens.push(<span key={tokens.length} className="text-[#89DDFF]">{code[i]}</span>);
      i++;
      continue;
    }

    // Multi-char operators: ==, !=, >=, <=
    if (i + 1 < code.length && ["==", "!=", ">=", "<="].includes(code.slice(i, i + 2))) {
      tokens.push(<span key={tokens.length} className="text-[#89DDFF]">{code.slice(i, i + 2)}</span>);
      i += 2;
      continue;
    }
    // Single-char operators and punctuation
    if ("><+-*/%!&|^~,;:".includes(code[i])) {
      tokens.push(<span key={tokens.length} className="text-[#89DDFF]">{code[i]}</span>);
      i++;
      continue;
    }

    // Words (keywords, atoms, booleans, numbers)
    if (/[a-zA-Z0-9_.]/.test(code[i])) {
      let word = "";
      while (i < code.length && /[a-zA-Z0-9_.]/.test(code[i])) word += code[i++];

      // Keywords
      if (/^(AND|OR|NOT|IN)$/.test(word)) {
        tokens.push(<span key={tokens.length} className="text-[#BB9AF7] font-semibold">{word}</span>);
      }
      // Booleans
      else if (/^(true|false)$/i.test(word)) {
        tokens.push(<span key={tokens.length} className="text-[#FF9E64]">{word}</span>);
      }
      // Numbers
      else if (/^\d+(\.\d+)?$/.test(word)) {
        tokens.push(<span key={tokens.length} className="text-[#FF9E64]">{word}</span>);
      }
      // Atom paths (state.*, tag.*, event.*)
      else if (/^(state|tag|event)\./.test(word)) {
        const dotIdx = word.indexOf(".");
        const prefix = word.slice(0, dotIdx);
        const rest = word.slice(dotIdx);
        tokens.push(
          <span key={tokens.length}>
            <span className="text-[#7AA2F7]">{prefix}</span>
            <span className="text-[#7982A9]">.</span>
            <span className="text-[#73DACA]">{rest.slice(1)}</span>
          </span>
        );
      }
      // Other identifiers
      else {
        tokens.push(<span key={tokens.length} className="text-[#C0CAF5]">{word}</span>);
      }
      continue;
    }

    // Fallback — ensure visible on dark bg
    tokens.push(<span key={tokens.length} className="text-[#89DDFF]">{code[i]}</span>);
    i++;
  }

  return tokens;
}

// --- JSON highlighter ---
function highlightJSON(code: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let i = 0;

  while (i < code.length) {
    // Whitespace / newlines
    if (/[\s\n\r]/.test(code[i])) {
      let ws = "";
      while (i < code.length && /[\s\n\r]/.test(code[i])) ws += code[i++];
      tokens.push(ws);
      continue;
    }

    // Strings
    if (code[i] === '"') {
      let str = '"';
      i++;
      while (i < code.length && code[i] !== '"') {
        if (code[i] === "\\") {
          str += code[i++]; // escape char
          if (i < code.length) str += code[i++];
        } else {
          str += code[i++];
        }
      }
      if (i < code.length) str += code[i++]; // closing quote

      // Check if this is a key (followed by colon after optional whitespace)
      let j = i;
      while (j < code.length && /\s/.test(code[j])) j++;
      if (j < code.length && code[j] === ":") {
        tokens.push(<span key={tokens.length} className="text-[#7AA2F7]">{str}</span>);
      } else {
        tokens.push(<span key={tokens.length} className="text-[#9ECE6A]">{str}</span>);
      }
      continue;
    }

    // Numbers
    if (/[-\d]/.test(code[i])) {
      let num = "";
      if (code[i] === "-") num += code[i++];
      while (i < code.length && /[\d.eE+-]/.test(code[i])) num += code[i++];
      tokens.push(<span key={tokens.length} className="text-[#FF9E64]">{num}</span>);
      continue;
    }

    // Booleans / null
    const remaining = code.slice(i);
    const boolMatch = remaining.match(/^(true|false|null)/);
    if (boolMatch) {
      tokens.push(<span key={tokens.length} className="text-[#FF9E64]">{boolMatch[1]}</span>);
      i += boolMatch[1].length;
      continue;
    }

    // Structural: braces, brackets, colon, comma
    if ("{[".includes(code[i])) {
      tokens.push(<span key={tokens.length} className="text-[#89DDFF]">{code[i]}</span>);
      i++;
      continue;
    }
    if ("}]".includes(code[i])) {
      tokens.push(<span key={tokens.length} className="text-[#89DDFF]">{code[i]}</span>);
      i++;
      continue;
    }
    if (code[i] === ":") {
      tokens.push(<span key={tokens.length} className="text-[#89DDFF]">{code[i]}</span>);
      i++;
      continue;
    }
    if (code[i] === ",") {
      tokens.push(<span key={tokens.length} className="text-[#565F89]">{code[i]}</span>);
      i++;
      continue;
    }

    // Fallback — ensure visible on dark bg
    tokens.push(<span key={tokens.length} className="text-[#89DDFF]">{code[i]}</span>);
    i++;
  }

  return tokens;
}

function highlight(code: string, language?: string): React.ReactNode[] {
  if (language === "json") return highlightJSON(code);
  if (language === "dsl" || language === "sql" || language === "trigger") return highlightDSL(code);
  return [code];
}

const LANG_LABELS: Record<string, string> = {
  json: "JSON",
  dsl: "TRIGGER DSL",
  sql: "TRIGGER DSL",
  trigger: "TRIGGER DSL",
};

export function CodeBlock({ children, language, className, inline }: CodeBlockProps) {
  if (inline) {
    return (
      <code className={clsx(
        "px-2 py-0.5 rounded-md bg-[#1E2028] text-[12px] font-mono text-[#A9B1D6]",
        className,
      )}>
        {highlight(children, language)}
      </code>
    );
  }

  return (
    <div className={clsx("rounded-xl overflow-hidden border border-zinc-800/50", className)}>
      {language && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#1A1D24] border-b border-zinc-700/40">
          <span className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
            {LANG_LABELS[language] || language}
          </span>
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-zinc-700" />
            <span className="w-2 h-2 rounded-full bg-zinc-700" />
            <span className="w-2 h-2 rounded-full bg-zinc-700" />
          </div>
        </div>
      )}
      <pre className="p-4 bg-[#1E2028] overflow-x-auto">
        <code className="text-[13px] font-mono leading-relaxed whitespace-pre-wrap break-words">
          {highlight(children, language)}
        </code>
      </pre>
    </div>
  );
}

/** Inline trigger expression — dark terminal background for contrast */
export function TriggerExpression({ children, className }: { children: string; className?: string }) {
  return (
    <span className={clsx(
      "inline-block px-2.5 py-1 rounded-lg bg-[#1E2028] text-[12px] font-mono leading-relaxed",
      className,
    )}>
      {highlightDSL(children)}
    </span>
  );
}
