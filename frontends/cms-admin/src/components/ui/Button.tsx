import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-display transition-[color,background-color,border-color,box-shadow,opacity,translate,scale] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 active:scale-[0.97] disabled:active:scale-100";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-bg shadow-[0_8px_24px_-10px_var(--color-accent-strong)] hover:bg-accent-soft light:text-white light:hover:bg-accent-strong",
  secondary: "border border-line-strong bg-card text-fg hover:border-accent/60 hover:text-accent",
  ghost: "text-muted hover:bg-tint/5 hover:text-fg",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-10 px-5 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}
