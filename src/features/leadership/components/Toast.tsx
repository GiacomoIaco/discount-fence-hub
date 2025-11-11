import { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = type === 'success' ? 'bg-green-50' : 'bg-red-50';
  const borderColor = type === 'success' ? 'border-green-200' : 'border-red-200';
  const textColor = type === 'success' ? 'text-green-900' : 'text-red-900';
  const Icon = type === 'success' ? CheckCircle : XCircle;
  const iconColor = type === 'success' ? 'text-green-500' : 'text-red-500';

  return (
    <div
      className={`fixed top-4 right-4 z-50 ${bgColor} border-2 ${borderColor} rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[300px] max-w-md animate-in slide-in-from-top-5`}
    >
      <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0`} />
      <span className={`text-sm font-medium ${textColor} flex-1`}>{message}</span>
      <button
        onClick={onClose}
        className={`${textColor} hover:opacity-70 transition-opacity`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
