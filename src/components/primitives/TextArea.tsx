import { type TextareaHTMLAttributes, useRef, useEffect } from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSubmit?: () => void;
  onCancel?: () => void;
}

export function TextArea({
  onSubmit,
  onCancel,
  className = "",
  ...props
}: TextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit?.();
    }
    if (e.key === "Escape") {
      onCancel?.();
    }
  };

  return (
    <textarea
      ref={ref}
      className={`w-full p-2 text-sm font-sans leading-relaxed text-text dark:text-text-dark bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md resize-y outline-none transition-border-color focus:border-accent dark:focus:border-accent-dark ${className}`}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}
