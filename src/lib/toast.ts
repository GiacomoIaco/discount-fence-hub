import toast from 'react-hot-toast';

export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
    style: {
      background: '#10B981',
      color: '#fff',
      fontWeight: '500',
    },
  });
};

export const showError = (message: string) => {
  toast.error(message, {
    duration: 4000,
    style: {
      background: '#EF4444',
      color: '#fff',
      fontWeight: '500',
    },
  });
};

export const showInfo = (message: string) => {
  toast(message, {
    duration: 3000,
    icon: 'ℹ️',
    style: {
      background: '#3B82F6',
      color: '#fff',
      fontWeight: '500',
    },
  });
};

export const showWarning = (message: string) => {
  toast(message, {
    duration: 3500,
    icon: '⚠️',
    style: {
      background: '#F59E0B',
      color: '#fff',
      fontWeight: '500',
    },
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message, {
    style: {
      background: '#6B7280',
      color: '#fff',
      fontWeight: '500',
    },
  });
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
