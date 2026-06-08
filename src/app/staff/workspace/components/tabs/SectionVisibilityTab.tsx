'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { HomepageSection } from '../../types';

export default function SectionVisibilityTab() {
  const supabase = createClient();

  const [homepageSections, setHomepageSections] = useState<HomepageSection[]>([]);
  const [homepageSectionsSaving, setHomepageSectionsSaving] = useState<Record<string, boolean>>({});
  const [homepageSectionsLoading, setHomepageSectionsLoading] = useState(false);

  const loadHomepageSections = async () => {
    setHomepageSectionsLoading(true);
    const { data: sectionData } = await supabase.from('homepage_section_settings').select('*').order('section_key');
    if (sectionData) {
      const sectionOrder: Record<string, number> = { hero_badge: 0, what_we_do: 1, customer_favourites: 2, the_process: 3, testimonials: 4 };
      const sorted = [...sectionData]
        .filter(s => s.section_key !== 'ticker_banner')
        .sort((a, b) => (sectionOrder[a.section_key] ?? 99) - (sectionOrder[b.section_key] ?? 99));
      setHomepageSections(sorted);
    }
    setHomepageSectionsLoading(false);
  };

  useEffect(() => {
    loadHomepageSections();
  }, []);

  const handleToggleHomepageSection = async (sectionKey: string, visible: boolean) => {
    setHomepageSectionsSaving(prev => ({ ...prev, [sectionKey]: true }));
    await supabase
      .from('homepage_section_settings')
      .update({ is_visible: visible, updated_at: new Date().toISOString() })
      .eq('section_key', sectionKey);
    setHomepageSections(prev =>
      prev.map(s => s.section_key === sectionKey ? { ...s, is_visible: visible } : s)
    );
    setHomepageSectionsSaving(prev => ({ ...prev, [sectionKey]: false }));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1612]">Section Visibility</h2>
        <p className="text-sm text-[#8C8278] mt-0.5">Show or hide homepage sections</p>
      </div>
      {homepageSectionsLoading ? (
        <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {homepageSections.map(section => (
            <div key={section.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#1A1612] text-sm">{section.section_label}</p>
                <p className="text-xs text-[#8C8278]">{section.section_key}</p>
              </div>
              <button
                onClick={() => handleToggleHomepageSection(section.section_key, !section.is_visible)}
                disabled={homepageSectionsSaving[section.section_key]}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${section.is_visible ? 'bg-[#C4622D]' : 'bg-gray-200'} disabled:opacity-50`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${section.is_visible ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
          {homepageSections.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No sections found.</p></div>}
        </div>
      )}
    </div>
  );
}
