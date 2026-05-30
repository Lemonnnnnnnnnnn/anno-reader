interface ErrorBannerProps {
  message: string;
  className?: string;
}

export function ErrorBanner({ message, className = "" }: ErrorBannerProps) {
  return <p className={`text-sm text-error ${className}`}>{message}</p>;
}
