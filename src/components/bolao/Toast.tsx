import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-green-400" />,
  error: <AlertCircle className="w-5 h-5 text-red-400" />,
  info: <Info className="w-5 h-5 text-blue-400" />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-green-500/30',
  error: 'border-red-500/30',
  info: 'border-blue-500/30',
};

export default function Toast({ message, type, isVisible, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md"
        >
          <div
            className={`flex items-center gap-3 px-5 py-4 rounded-2xl bg-[#1A1A1A]/95 backdrop-blur-xl border ${borderColors[type]} shadow-2xl shadow-black/40`}
          >
            {icons[type]}
            <p className="text-sm font-semibold text-white/90 flex-1">{message}</p>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for easy toast management
export function useToast() {
  const [toast, setToast] = React.useState<{
    message: string;
    type: ToastType;
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  return { toast, showToast, hideToast };
}
