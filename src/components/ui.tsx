import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  Atom,
  BookOpen,
  Calculator,
  Cpu,
  FlaskConical,
  Landmark,
  Languages,
  Leaf,
  Microscope,
  Radical,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  calculator: Calculator,
  leaf: Leaf,
  languages: Languages,
  flask: FlaskConical,
  landmark: Landmark,
  cpu: Cpu,
  radical: Radical,
  atom: Atom,
  microscope: Microscope,
  book: BookOpen,
};

export function SubjectIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? BookOpen;
  return <Icon className={className ?? "size-5"} aria-hidden="true" />;
}

export function toneClass(color: string): string {
  if (color === "cinnamon") return "bg-accent-soft text-accent";
  if (color === "ink") return "border border-border bg-bg text-fg";
  return "bg-soft text-primary";
}

export const fieldClass =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-fg placeholder:text-muted";

export const labelClass = "mb-1 block text-sm font-medium text-fg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  children: ReactNode;
};

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const look =
    variant === "ghost"
      ? "border border-border bg-surface text-fg hover:bg-soft"
      : variant === "danger"
        ? "bg-accent text-accent-fg hover:opacity-90"
        : "bg-primary text-primary-fg hover:opacity-90";
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50 ${look} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, kind = "free" }: { children: ReactNode; kind?: "free" | "premium" | "muted" }) {
  const look =
    kind === "premium"
      ? "bg-accent-soft text-accent"
      : kind === "muted"
        ? "bg-bg text-muted"
        : "bg-soft text-primary";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${look}`}>{children}</span>;
}
