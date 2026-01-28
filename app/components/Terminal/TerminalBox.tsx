"use client";

import { ReactNode } from "react";

interface TerminalBoxProps {
  children: ReactNode;
  className?: string;
}

export function TerminalBox({ children, className = "" }: TerminalBoxProps) {
  return (
    <div
      className={`bg-void border border-slate-800 shadow-hard rounded-md ${className}`}
    >
      {children}
    </div>
  );
}
