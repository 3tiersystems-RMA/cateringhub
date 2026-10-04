'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SocialLink } from '../../types';

export default function SocialMediaTab() {
  const supabase = createClient();

  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [socialLinksLoading, setSocialLinksLoading] = useState(false);
  const [socialLinksSaving, setSocialLinksSaving] = useState(false);
  const [socialLinksError, setSocialLinksError] = useState('');
  const [socialLinksSuccess, setSocialLinksSuccess] = useState('');
  const [socialLinksForm, setSocialLinksForm] = useState<Record<string, string>>({});

  const loadSocialLinks = async () => {
    setSocialLinksLoading(true);
    const { data } = await supabase.from('social_links').select('*').order('display_order');
    if (data) {
      setSocialLinks(data);
      const form: Record<string, string> = {};
      data.forEach((s: SocialLink) => { form[s.platform] = s.url; });
      setSocialLinksForm(form);
    }
    setSocialLinksLoading(false);
  };

  useEffect(() => {
    loadSocialLinks();
  }, []);

  const handleSaveSocialLinks = async () => {
    setSocialLinksSaving(true);
    setSocialLinksError('');
    setSocialLinksSuccess('');
    try {
      for (const s of socialLinks) {
        await supabase.from('social_links').update({ url: socialLinksForm[s.platform] || '' }).eq('id', s.id);
      }
      setSocialLinksSuccess('Social links saved!');
    } catch (err: unknown) {
      setSocialLinksError(err instanceof Error ? err.message : 'Failed to save social links.');
    } finally {
      setSocialLinksSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-xl font-bold text-[#1A1612]">Social Media Links</h2><p className="text-sm text-[#8C8278] mt-0.5">Manage your social media presence</p></div>
        <button onClick={handleSaveSocialLinks} disabled={socialLinksSaving} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{socialLinksSaving ? 'Saving…' : 'Save Links'}</button>
      </div>
      {socialLinksError && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4"><p className="text-sm text-red-600">{socialLinksError}</p></div>}
      {socialLinksSuccess && <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4"><p className="text-sm text-green-600">{socialLinksSuccess}</p></div>}
      {socialLinksLoading ? (
        <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {socialLinks.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4">
              <label className="block text-xs font-semibold text-[#5C5347] mb-1 capitalize">{s.platform}</label>
              <input type="url" value={socialLinksForm[s.platform] || ''} onChange={e => setSocialLinksForm(f => ({ ...f, [s.platform]: e.target.value }))} placeholder="https://..." className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
            </div>
          ))}
          {socialLinks.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No social links configured.</p></div>}
        </div>
      )}
    </div>
  );
}
