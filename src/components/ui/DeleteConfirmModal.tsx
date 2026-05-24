'use client';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
  title?: string;
  confirmLabel?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  productName,
  onConfirm,
  onCancel,
  message,
  title,
  confirmLabel,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  const isExpireAction = confirmLabel === 'Expire';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#DDD5C8] w-full max-w-md mx-4 p-8">
        <div className="flex justify-center mb-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isExpireAction ? 'bg-orange-100' : 'bg-red-100'}`}>
            {isExpireAction ? (
              <svg className="w-7 h-7 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </div>
        </div>
        <h2 className="text-xl font-bold text-[#1A1612] text-center mb-3">{title ?? 'Confirm Deletion'}</h2>
        <p className="text-[#5C5347] text-sm text-center mb-6">
          {message ?? <>Are you sure you want to delete this product: <span className="font-semibold text-[#1A1612]">{productName}</span>?</>}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-white text-[#5C5347] border border-[#DDD5C8] py-3 rounded-xl font-semibold text-sm hover:bg-[#F5F0E8] transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${isExpireAction ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {confirmLabel ?? 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
