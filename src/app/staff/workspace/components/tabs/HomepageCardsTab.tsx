'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import type { HomepageCard } from '../../types';

const CARD_TYPE_LABELS: Record<HomepageCard['card_type'], string> = {
  todays_special: "Today's Special",
  next_booking: 'Next Booking',
  customer_review: 'Customer Review',
  announcement: 'Announcement',
};

const CARD_TYPE_ICONS: Record<HomepageCard['card_type'], string> = {
  todays_special: '🍽️',
  next_booking: '📅',
  customer_review: '⭐',
  announcement: '📢',
};

interface HomepageCardsTabProps {
  can: (action: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

export default function HomepageCardsTab({ can }: HomepageCardsTabProps) {
  const supabase = createClient();

  const [homepageCards, setHomepageCards] = useState<HomepageCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [editingCard, setEditingCard] = useState<HomepageCard | null>(null);
  const [cardForm, setCardForm] = useState<Partial<HomepageCard>>({});
  const [cardFormError, setCardFormError] = useState('');
  const [cardFormSuccess, setCardFormSuccess] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [togglingCardId, setTogglingCardId] = useState<string | null>(null);
  const [homepageCardSearchQuery, setHomepageCardSearchQuery] = useState('');
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [uploadingCardImage, setUploadingCardImage] = useState(false);
  const [tickerBannerText, setTickerBannerText] = useState('Now Accepting 2027 Bookings');
  const [tickerBannerVisible, setTickerBannerVisible] = useState(false);
  const [tickerBannerLoading, setTickerBannerLoading] = useState(false);
  const [tickerBannerSaving, setTickerBannerSaving] = useState(false);
  const [tickerBannerSuccess, setTickerBannerSuccess] = useState('');
  const [tickerBannerEditing, setTickerBannerEditing] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');

  const loadHomepageCards = async () => {
    setCardsLoading(true);
    const { data } = await supabase.from('homepage_cards').select('*').order('display_order');
    if (data) setHomepageCards(data);
    setCardsLoading(false);
  };

  const loadTickerBanner = async () => {
    setTickerBannerLoading(true);
    const { data } = await supabase
      .from('homepage_section_settings')
      .select('is_visible, banner_text')
      .eq('section_key', 'ticker_banner')
      .single();
    if (data) {
      setTickerBannerVisible(data.is_visible);
      if (data.banner_text) setTickerBannerText(data.banner_text);
    }
    setTickerBannerLoading(false);
  };

  useEffect(() => {
    loadHomepageCards();
    loadTickerBanner();
  }, []);

  const handleSaveTickerBanner = async () => {
    setTickerBannerSaving(true);
    await supabase
      .from('homepage_section_settings')
      .update({ banner_text: tickerBannerText })
      .eq('section_key', 'ticker_banner');
    setTickerBannerSuccess('Banner text saved!');
    setTickerBannerSaving(false);
    setTimeout(() => setTickerBannerSuccess(''), 3000);
  };

  const handleToggleTickerBanner = async () => {
    const newVisible = !tickerBannerVisible;
    setTickerBannerLoading(true);
    await supabase
      .from('homepage_section_settings')
      .update({ is_visible: newVisible })
      .eq('section_key', 'ticker_banner');
    await loadTickerBanner();
  };

  const handleSaveCard = async () => {
    if (!editingCard) return;
    setSavingCard(true);
    setCardFormError('');
    let image_url = cardForm.image_url || null;
    let image_path = editingCard.image_path || null;
    if (cardImageFile) {
      setUploadingCardImage(true);
      const ext = cardImageFile.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('homepage-card-images').upload(path, cardImageFile);
      if (uploadErr) { setCardFormError(uploadErr.message); setSavingCard(false); setUploadingCardImage(false); return; }
      image_path = path;
      const { data: urlData } = supabase.storage.from('homepage-card-images').getPublicUrl(path);
      image_url = urlData?.publicUrl || null;
      setUploadingCardImage(false);
    }
    const { data: upd, error } = await supabase.from('homepage_cards').update({
      ...cardForm,
      image_url,
      image_path,
      updated_at: new Date().toISOString(),
    }).eq('id', editingCard.id).select('id');
    if (error) { setCardFormError(error.message); }
    else if (!upd || upd.length === 0) { setCardFormError('Update was blocked — you may not have permission to edit homepage cards.'); }
    else { setCardFormSuccess('Card updated!'); setEditingCard(null); await loadHomepageCards(); }
    setSavingCard(false);
  };

  const filteredCards = homepageCards.filter(c =>
    !homepageCardSearchQuery || c.title.toLowerCase().includes(homepageCardSearchQuery.toLowerCase())
  );

  return (
    <>
      <VoucherErrorModal
        isOpen={!!globalError}
        title={globalErrorTitle || 'Error'}
        message={globalError}
        onClose={() => { setGlobalError(''); setGlobalErrorTitle(''); }}
      />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1A1612]">Home Page Cards</h2>
            <p className="text-sm text-[#8C8278] mt-0.5">Manage homepage feature cards and the bookings banner</p>
          </div>
          <input type="text" placeholder="Search cards…" value={homepageCardSearchQuery} onChange={e => setHomepageCardSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
        </div>
        <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-[#1A1612] text-sm">Bookings Banner</p>
              <p className="text-xs text-[#8C8278]">Scrolling announcement banner on the homepage</p>
            </div>
            <div className="flex items-center gap-3">
              {can('edit') && (
                <button onClick={() => setTickerBannerEditing(!tickerBannerEditing)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
              )}
              <button
                onClick={handleToggleTickerBanner}
                disabled={tickerBannerLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tickerBannerVisible ? 'bg-[#C4622D]' : 'bg-gray-200'} disabled:opacity-50`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tickerBannerVisible ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          {tickerBannerEditing && (
            <div className="flex gap-3 mt-2">
              <input type="text" value={tickerBannerText} onChange={e => setTickerBannerText(e.target.value)} className="flex-1 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
              <button onClick={handleSaveTickerBanner} disabled={tickerBannerSaving} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{tickerBannerSaving ? 'Saving…' : 'Save'}</button>
            </div>
          )}
          {tickerBannerSuccess && <p className="text-xs text-green-600 mt-2">{tickerBannerSuccess}</p>}
        </div>
        {cardsLoading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {filteredCards.map(card => (
              <div key={card.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{CARD_TYPE_ICONS[card.card_type]}</span>
                    <p className="font-semibold text-[#1A1612] truncate">{card.title}</p>
                    <span className="text-xs text-[#8C8278] bg-[#F5F0E8] px-2 py-0.5 rounded-full">{CARD_TYPE_LABELS[card.card_type]}</span>
                  </div>
                  {card.subtitle && <p className="text-xs text-[#8C8278] truncate">{card.subtitle}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={async () => {
                      setTogglingCardId(card.id);
                      const { data, error } = await supabase.from('homepage_cards').update({ is_visible: !card.is_visible }).eq('id', card.id).select('id');
                      if (error || !data || data.length === 0) {
                        setGlobalError('Could not update card visibility — please try again.');
                        setGlobalErrorTitle('Homepage Card Error');
                      }
                      await loadHomepageCards();
                      setTogglingCardId(null);
                    }}
                    disabled={togglingCardId === card.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${card.is_visible ? 'bg-[#C4622D]' : 'bg-gray-200'} disabled:opacity-50`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${card.is_visible ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  {can('edit') && (
                    <button onClick={() => { setEditingCard(card); setCardForm({ ...card }); setCardFormError(''); setCardFormSuccess(''); setCardImageFile(null); }} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                  )}
                </div>
              </div>
            ))}
            {homepageCards.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No homepage cards found.</p></div>}
          </div>
        )}
        {editingCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A1612]">Edit {CARD_TYPE_LABELS[editingCard.card_type]}</h3>
                <button onClick={() => setEditingCard(null)} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
              </div>
              <div className="p-5 space-y-3">
                <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Title *</label><input type="text" value={cardForm.title || ''} onChange={e => setCardForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Subtitle</label><input type="text" value={cardForm.subtitle || ''} onChange={e => setCardForm(f => ({ ...f, subtitle: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                {cardFormError && <p className="text-sm text-red-600">{cardFormError}</p>}
                {cardFormSuccess && <p className="text-sm text-green-600">{cardFormSuccess}</p>}
              </div>
              <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                <button onClick={handleSaveCard} disabled={savingCard || uploadingCardImage} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{savingCard ? 'Saving…' : 'Save Changes'}</button>
                <button onClick={() => setEditingCard(null)} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
