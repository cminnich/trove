"use client";

interface TerminalHeaderProps {
  title: string;
  className?: string;
}

export function TerminalHeader({ title, className = "" }: TerminalHeaderProps) {
  return (
    <div
      className={`font-mono text-xs uppercase tracking-widest text-slate-500 border-b border-slate-800 px-4 py-2 ${className}`}
    >
      {title}
    </div>
  );
}
