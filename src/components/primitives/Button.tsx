import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "icon" | "nav";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClasses = {
  primary:
    "bg-accent dark:bg-accent-dark text-white hover:bg-accent-hover dark:hover:bg-accent-hover-dark rounded-md font-medium transition-colors",
  secondary:
    "bg-transparent border border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark rounded-md font-medium transition-colors",
  icon: "bg-transparent rounded p-1.5 w-7 h-7 flex items-center justify-center",
  nav: "bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md hover:bg-bg dark:hover:bg-bg-dark transition-colors",
};

const sizeClasses = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseClasses = "font-sans cursor-pointer transition-all";
  const variantClass = variantClasses[variant];
  const sizeClass = variant !== "icon" ? sizeClasses[size] : "";
  const disabledClasses =
    disabled || loading ? "opacity-60 cursor-not-allowed" : "";

  return (
    <button
      className={`${baseClasses} ${variantClass} ${sizeClass} ${disabledClasses} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}
