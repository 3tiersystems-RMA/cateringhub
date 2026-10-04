'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import type { PackageVisibilityItem } from '../../types';

export default function PackageVisibilityTab() {
  const supabase = createClient();

  const [packageVisibility, setPackageVisibility] = useState<PackageVisibilityItem[]>([]);
  const [packageVisibilityLoading, setPackageVisibilityLoading] = useState(false);
  const [packageVisibilitySaving, setPackageVisibilitySaving] = useState<Record<string, boolean>>({});
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');

  const loadPackageVisibility = async () => {
    setPackageVisibilityLoading(true);
    const { data } = await supabase
      .from('package_visibility')
      .select('*')
      .order('package_name');
    if (data) setPackageVisibility(data);
    setPackageVisibilityLoading(false);
  };

  useEffect(() => {
    loadPackageVisibility();
  }, []);

  const handleTogglePackageVisibility = async (id: string, newValue: boolean) => {
    setPackageVisibilitySaving(prev => ({ ...prev, [id]: true }));
    const { data, error } = await supabase
      .from('package_visibility')
      .update({ is_visible: newValue, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    if (error || !data || data.length === 0) {
      setGlobalError('Could not update package visibility — please try again.');
      setGlobalErrorTitle('Package Visibility Error');
      await loadPackageVisibility();
    } else {
      setPackageVisibility(prev =>
        prev.map(p => p.id === id ? { ...p, is_visible: newValue } : p)
      );
    }
    setPackageVisibilitySaving(prev => ({ ...prev, [id]: false }));
  };

  return (
    <>
      <VoucherErrorModal
        isOpen={!!globalError}
        title={globalErrorTitle || 'Error'}
        message={globalError}
        onClose={() => { setGlobalError(''); setGlobalErrorTitle(''); }}
      />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#1A1612]">Package Visibility</h2>
          <p className="text-sm text-[#8C8278] mt-0.5">Show or hide meal package types on the products page</p>
        </div>
        {packageVisibilityLoading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {packageVisibility.map(pkg => (
              <div key={pkg.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between">
                <p className="font-semibold text-[#1A1612] text-sm">{pkg.package_name}</p>
                <button
                  onClick={() => handleTogglePackageVisibility(pkg.id, !pkg.is_visible)}
                  disabled={packageVisibilitySaving[pkg.id]}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${pkg.is_visible ? 'bg-[#C4622D]' : 'bg-gray-200'} disabled:opacity-50`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pkg.is_visible ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
            {packageVisibility.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No packages found.</p></div>}
          </div>
        )}
      </div>
    </>
  );
}
