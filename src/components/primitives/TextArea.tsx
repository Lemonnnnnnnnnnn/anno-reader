import {
  type TextareaHTMLAttributes,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSubmit?: () => void;
  onCancel?: () => void;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(
    { onSubmit, onCancel, className = "", ...props },
    externalRef,
  ) {
    const internalRef = useRef<HTMLTextAreaElement>(null);

    // Expose the internal ref to external consumers
    useImperativeHandle(externalRef, () => internalRef.current!);

    useEffect(() => {
      internalRef.current?.focus();
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
        ref={internalRef}
        className={`w-full p-2 text-sm font-sans leading-relaxed text-text dark:text-text-dark bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md resize-none outline-none transition-border-color focus:border-accent dark:focus:border-accent-dark ${className}`}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  },
);
