"use client";

interface DespatchModalProps {
  onChoice: (choice: 'collection' | 'delivery') => void;
}

export default function DespatchModal({ onChoice }: DespatchModalProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#EDE7DA] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-[#1A1612] mb-1">
            How must we despatch your order?
          </h3>
          <p className="text-sm text-[#8C8278]">
            Choose how you&apos;d like to receive your order.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onChoice('collection')}
            className="w-full flex items-center gap-4 bg-white border-2 border-[#DDD5C8] hover:border-[#C4622D] rounded-2xl px-5 py-4 text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-[#EDE7DA] group-hover:bg-[#F5EDE6] flex items-center justify-center flex-shrink-0 transition-colors">
              <svg className="w-5 h-5 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1612]">I will collect</p>
              <p className="text-xs text-[#8C8278] mt-0.5">Pick up from our despatch address · No delivery fee</p>
            </div>
          </button>

          <button
            onClick={() => onChoice('delivery')}
            className="w-full flex items-center gap-4 bg-white border-2 border-[#DDD5C8] hover:border-[#C4622D] rounded-2xl px-5 py-4 text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-[#EDE7DA] group-hover:bg-[#F5EDE6] flex items-center justify-center flex-shrink-0 transition-colors">
              <svg className="w-5 h-5 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1612]">To be delivered</p>
              <p className="text-xs text-[#8C8278] mt-0.5">We deliver to your address · Fee calculated by distance</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
