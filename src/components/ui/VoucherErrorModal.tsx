'use client';

interface VoucherErrorModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  title?: string;
}

export default function VoucherErrorModal({ isOpen, message, onClose, title = 'Error' }: VoucherErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#DDD5C8] w-full max-w-md mx-4 p-8">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-[#FEF3EE] flex items-center justify-center">
            <svg className="w-7 h-7 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-[#1A1612] text-center mb-3">{title}</h2>
        <p className="text-[#5C5347] text-sm text-center mb-6">{message}</p>
        <button
          onClick={onClose}
          className="w-full bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-all duration-200"
        >
          OK
        </button>
      </div>
    </div>
  );
}
