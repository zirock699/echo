import { useEffect } from "react";
import {
  Info,
  Check,
  AlertTriangle,
  XCircle,
  X,
} from "lucide-react";
import { cn } from "../../utils/cn";

export type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
  duration?: number;
}

const variantStyles: Record<ToastVariant, string> = {
  info: "bg-slate-800 border-slate-700 text-slate-200",
  success: "bg-emerald-900/50 border-emerald-700 text-emerald-200",
  warning: "bg-amber-900/50 border-amber-700 text-amber-200",
  error: "bg-red-900/50 border-red-700 text-red-200",
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  info: <Info className="w-4 h-4" />,
  success: <Check className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  error: <XCircle className="w-4 h-4" />,
};

export const Toast = ({
  message,
  variant = "info",
  onClose,
  duration = 6000,
}: ToastProps) => {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-[var(--shadow-lg)]",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
        variantStyles[variant]
      )}
    >
      <div className="shrink-0">{variantIcons[variant]}</div>
      <p className="text-sm flex-1">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
