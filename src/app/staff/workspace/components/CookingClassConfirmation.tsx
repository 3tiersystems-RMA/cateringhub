'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SessionDate {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_name: string | null;
  class_fee: number | null;
}

interface AwaitingRegistration {
  id: string;
  title: string;
  first_name: string;
  surname: string;
  email: string;
  cellphone: string;
  payment_status: string;
  amount: number | null;
  created_at: string;
  notes: string | null;
  registration_code: string | null;
  session_dates?: SessionDate[];
  children?: Array<{
    fullName?: string;
    full_name?: string;
    name?: string;
    age?: string | number;
    gender?: string;
    ticket_number?: string;
  }>;
}

interface CorrespondenceSettings {
  form_header_title: string | null;
  logo_url: string | null;
}

interface CookingClassConfirmationProps {
  userRole: string;
}

export default function CookingClassConfirmation({ userRole }: CookingClassConfirmationProps) {
  const supabase = createClient();

  const [registrations, setRegistrations] = useState<AwaitingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [correspondenceSettings, setCorrespondenceSettings] = useState<CorrespondenceSettings | null>(null);

  const [previewReg, setPreviewReg] = useState<AwaitingRegistration | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [viewReg, setViewReg] = useState<AwaitingRegistration | null>(null);

  const isAuthorized = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  const loadData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError('');

    const [regsResult, settingsResult] = await Promise.all([
      supabase
        .from('cooking_class_registrations')
        .select('id, title, first_name, surname, email, cellphone, payment_status, amount, created_at, notes, registration_code, children')
        .eq('payment_status', 'awaiting_confirmation')
        .order('created_at', { ascending: false }),
      supabase
        .from('correspondence_settings')
        .select('form_header_title, logo_url')
        .limit(1)
        .maybeSingle(),
    ]);

    if (regsResult.error) {
      setError('Failed to load registrations: ' + regsResult.error.message);
      setRegistrations([]);
    } else {
      const regs = (regsResult.data as AwaitingRegistration[]) || [];

      if (regs.length > 0) {
        const regIds = regs.map(r => r.id);

        // Fetch booking counts (links registrations → event_dates)
        const { data: bookings } = await supabase
          .from('cooking_class_booking_counts')
          .select('registration_id, event_date_id')
          .in('registration_id', regIds);

        const eventDateIds = [...new Set((bookings || []).map((b: { event_date_id: string }) => b.event_date_id))];
        const eventDatesMap: Record<string, SessionDate> = {};

        if (eventDateIds.length > 0) {
          const { data: dates } = await supabase
            .from('cooking_class_event_dates')
            .select('id, event_date, start_time, end_time, location, class_fee, event_id')
            .in('id', eventDateIds);

          if (dates && dates.length > 0) {
            const eventIds = [...new Set(dates.map((d: { event_id: string }) => d.event_id).filter(Boolean))];
            const eventsMap: Record<string, string> = {};
            if (eventIds.length > 0) {
              const { data: events } = await supabase
                .from('cooking_class_events')
                .select('id, name')
                .in('id', eventIds);
              (events || []).forEach((e: { id: string; name: string }) => { eventsMap[e.id] = e.name; });
            }
            dates.forEach((d: { id: string; event_date: string | null; start_time: string | null; end_time: string | null; location: string | null; class_fee: number | null; event_id: string }) => {
              eventDatesMap[d.id] = {
                id: d.id,
                event_date: d.event_date,
                start_time: d.start_time,
                end_time: d.end_time,
                location: d.location,
                class_fee: d.class_fee,
                event_name: eventsMap[d.event_id] || null,
              };
            });
          }
        }

        // Build registration → session_dates map
        const regSessionMap: Record<string, SessionDate[]> = {};
        (bookings || []).forEach((b: { registration_id: string; event_date_id: string }) => {
          if (!regSessionMap[b.registration_id]) regSessionMap[b.registration_id] = [];
          if (eventDatesMap[b.event_date_id]) {
            regSessionMap[b.registration_id].push(eventDatesMap[b.event_date_id]);
          }
        });

        setRegistrations(regs.map(r => ({ ...r, session_dates: regSessionMap[r.id] || [] })));
      } else {
        setRegistrations([]);
      }
    }

    if (settingsResult.data) {
      setCorrespondenceSettings(settingsResult.data);
    }

    setLoading(false);
  }, [isAuthorized, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSendConfirmation = async () => {
    if (!previewReg) return;
    setSending(true);
    setSendResult(null);

    try {
      const { error: updateError } = await supabase
        .from('cooking_class_registrations')
        .update({ payment_status: 'paid' })
        .eq('id', previewReg.id);

      if (updateError) {
        throw new Error('Failed to update registration status: ' + updateError.message);
      }

      setSendResult({ success: true, message: 'Class booking confirmed. Registration marked as Paid.' });
      showToast('success', `Confirmation sent to ${previewReg.email}`);

      setTimeout(() => {
        setRegistrations(prev => prev.filter(r => r.id !== previewReg.id));
        setPreviewReg(null);
        setSendResult(null);
      }, 2000);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setSendResult({ success: false, message });
      showToast('error', message);
    } finally {
      setSending(false);
    }
  };

  const formatCurrency = (val: number | null) => val != null ? `R ${Number(val).toFixed(2)}` : '—';

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return '';
    try {
      const [h, m] = timeStr.split(':');
      const d = new Date();
      d.setHours(Number(h), Number(m));
      return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return timeStr;
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${reg.first_name} ${reg.surname}`.toLowerCase();
    return (
      reg.id.toLowerCase().includes(q) ||
      fullName.includes(q) ||
      reg.email.toLowerCase().includes(q)
    );
  });

  function EmailPreviewBody({ reg }: { reg: AwaitingRegistration }) {
    const fullName = `${reg.title ? reg.title + ' ' : ''}${reg.first_name} ${reg.surname}`;
    const orgName = correspondenceSettings?.form_header_title || 'Cardamom Kitchen';

    return (
      <div className="rounded-xl overflow-hidden border border-[#EDE7DA]">
        {/* Dark header */}
        <div className="bg-[#1A1612] px-6 py-5 text-center">
          {correspondenceSettings?.logo_url && (
            <img src={correspondenceSettings.logo_url} alt="Logo" className="h-10 object-contain mx-auto mb-2" />
          )}
          <h4 className="text-white font-bold text-lg">{orgName}</h4>
          <p className="text-[#C4622D] text-xs tracking-widest uppercase mt-1">Cooking &amp; Baking Classes</p>
        </div>

        {/* Confirmation Banner */}
        <div className="bg-green-50 border-b border-green-200 px-6 py-3 text-center">
          <p className="text-green-700 font-bold text-sm">✅ Cooking Class Booking Confirmation</p>
        </div>

        <div className="bg-white px-6 py-5 space-y-4">
          {/* Greeting */}
          <p className="text-[#5C5347] text-sm leading-relaxed">
            Dear <strong>{fullName}</strong>,<br />
            We are delighted to confirm your cooking class booking. Your registration has been received and your payment has been processed successfully.
          </p>

          {/* Booking Reference */}
          <div className="rounded-xl overflow-hidden border border-[#EDE7DA]">
            <div className="bg-[#EDE7DA] px-4 py-2.5">
              <p className="text-xs font-bold text-[#8C8278] uppercase tracking-wider">
                BOOKING REFERENCE — <span className="font-mono text-[#C4622D]">{reg.registration_code || reg.id.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#8C8278]">Registrant</span>
                <span className="font-semibold text-[#1A1612]">{fullName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8C8278]">Email</span>
                <span className="text-[#5C5347]">{reg.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8C8278]">Contact</span>
                <span className="text-[#5C5347]">{reg.cellphone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8C8278]">Registration Date</span>
                <span className="text-[#5C5347]">{formatDate(reg.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Class Session Details */}
          {reg.session_dates && reg.session_dates.length > 0 ? (
            <div className="rounded-xl overflow-hidden border border-[#EDE7DA]">
              <div className="bg-[#EDE7DA] px-4 py-2.5">
                <p className="text-xs font-bold text-[#8C8278] uppercase tracking-wider">CLASS SESSION DETAILS</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f9f6f2]">
                    <th className="px-4 py-2 text-left text-xs text-[#8C8278] font-semibold">Class</th>
                    <th className="px-4 py-2 text-left text-xs text-[#8C8278] font-semibold">Date</th>
                    <th className="px-4 py-2 text-left text-xs text-[#8C8278] font-semibold">Time</th>
                    <th className="px-4 py-2 text-right text-xs text-[#8C8278] font-semibold">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {reg.session_dates.map((s, i) => (
                    <tr key={i} className="border-t border-[#f0ebe4]">
                      <td className="px-4 py-2.5 text-[#1A1612]">
                        {s.event_name || '—'}
                        {s.location && (
                          <p className="text-xs text-[#8C8278] mt-0.5">{s.location}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#5C5347]">{formatDate(s.event_date)}</td>
                      <td className="px-4 py-2.5 text-[#5C5347] text-xs">
                        {s.start_time ? formatTime(s.start_time) : '—'}
                        {s.end_time ? ` – ${formatTime(s.end_time)}` : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1A1612]">{formatCurrency(s.class_fee)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#EDE7DA]">
                    <td colSpan={3} className="px-4 py-3 font-bold text-[#1A1612]">Total Amount Paid</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-[#C4622D]">{formatCurrency(reg.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-[#EDE7DA]">
              <div className="bg-[#EDE7DA] px-4 py-2.5">
                <p className="text-xs font-bold text-[#8C8278] uppercase tracking-wider">CLASS SESSION DETAILS</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f9f6f2]">
                    <th className="px-4 py-2 text-left text-xs text-[#8C8278] font-semibold">Class</th>
                    <th className="px-4 py-2 text-left text-xs text-[#8C8278] font-semibold">Date</th>
                    <th className="px-4 py-2 text-left text-xs text-[#8C8278] font-semibold">Time</th>
                    <th className="px-4 py-2 text-right text-xs text-[#8C8278] font-semibold">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[#f0ebe4]">
                    <td className="px-4 py-2.5 text-[#1A1612]">
                      Cardamom Kitchen Cooking Class
                      <p className="text-xs text-[#8C8278] mt-0.5">Cardamom Kitchen, Cape Town</p>
                    </td>
                    <td className="px-4 py-2.5 text-[#5C5347]">15 Jul 2026</td>
                    <td className="px-4 py-2.5 text-[#5C5347] text-xs">09:00 AM – 01:00 PM</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#1A1612]">R 350.00</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#EDE7DA]">
                    <td colSpan={3} className="px-4 py-3 font-bold text-[#1A1612]">Total Amount Paid</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-[#C4622D]">{formatCurrency(reg.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* What to Expect */}
          <div className="rounded-xl border border-[#EDE7DA] px-4 py-4 space-y-3">
            <p className="text-xs font-bold text-[#8C8278] uppercase tracking-wider">WHAT TO EXPECT</p>
            <ul className="text-sm text-[#5C5347] space-y-1.5 list-none">
              <li className="flex items-start gap-2"><span className="text-[#C4622D] mt-0.5">🎟️</span><span>Please bring this confirmation email or your booking reference on the day of the class.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#C4622D] mt-0.5">🕐</span><span>Please arrive 15 minutes before the class start time. We recommend arriving early.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#C4622D] mt-0.5">👨‍🍳</span><span>Aprons and all cooking equipment will be provided. Please wear comfortable clothing.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#C4622D] mt-0.5">📞</span><span>For any queries, please contact us at <strong>info@cardamomkitchen.co.za</strong></span></li>
            </ul>
          </div>

          {/* Notes */}
          {reg.notes && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Special Notes</p>
              <p className="text-sm text-amber-800">{reg.notes}</p>
            </div>
          )}

          {/* CTA */}
          <div>
            <p className="text-[#5C5347] text-sm mb-2">View your cooking class bookings:</p>
            <a href="https://cardamomkitchen.co.za/cooking-classes" target="_blank" rel="noopener noreferrer" className="inline-block bg-[#C4622D] text-white text-sm font-bold px-5 py-2.5 rounded-lg">View My Classes →</a>
          </div>

          {/* Footer */}
          <div className="border-t border-[#EDE7DA] pt-4 text-center">
            <p className="text-xs text-[#8C8278]">Thank you for booking with <strong>{orgName}</strong>. We look forward to cooking with you!</p>
            <p className="text-xs text-[#8C8278] mt-1">© {new Date().getFullYear()} {orgName} · All rights reserved</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-amber-700 font-semibold">Access Restricted</p>
          <p className="text-amber-600 text-sm mt-1">Cooking Class Confirmation is available to Admin and Super Admin only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 transition-all ${toastMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toastMessage.type === 'success' ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1A1612]">Cooking Class Confirmation</h2>
          <p className="text-sm text-[#8C8278] mt-0.5">Class bookings awaiting confirmation — send confirmation email to registrant</p>
        </div>
        <button
          onClick={loadData}
          className="border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm hover:bg-[#F5F0E8] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8278]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search by booking ref, registrant name or email…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm focus:outline-none focus:border-[#C4622D] bg-white"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">{error}</div>
      ) : filteredRegistrations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EDE7DA] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-[#1A1612] font-semibold">
            {searchQuery ? 'No registrations match your search' : 'No class bookings awaiting confirmation'}
          </p>
          <p className="text-[#8C8278] text-sm mt-1 max-w-md mx-auto">
            {searchQuery
              ? 'Try a different search term.'
              : 'Cooking class bookings with "awaiting_confirmation" status will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRegistrations.map(reg => (
            <div key={reg.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-[#1A1612] text-sm">{reg.title ? `${reg.title} ` : ''}{reg.first_name} {reg.surname}</p>
                  <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">Awaiting Confirmation</span>
                </div>
                <p className="text-xs text-[#8C8278] font-mono truncate">{reg.registration_code || reg.id}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <p className="text-xs text-[#5C5347]">{reg.email}</p>
                  <span className="text-[#DDD5C8]">·</span>
                  <p className="text-xs font-semibold text-[#C4622D]">{formatCurrency(reg.amount)}</p>
                  <span className="text-[#DDD5C8]">·</span>
                  <p className="text-xs text-[#8C8278]">{formatDate(reg.created_at)}</p>
                  <span className="text-[#DDD5C8]">·</span>
                  <p className="text-xs text-[#8C8278]">Cooking Class</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => { setPreviewReg(reg); setSendResult(null); }}
                  className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Send Confirmation
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => setViewReg(reg)}
                    className="border border-[#C4622D] text-[#C4622D] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#FDF6EE] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    View Confirmation
                  </button>
                )}
              </div>
              </div>

              {/* Participants Registered */}
              {Array.isArray(reg.children) && reg.children.filter(c => (c.fullName || c.full_name || c.name || '').trim()).length > 0 && (() => {
                const filled = reg.children!.filter(c => (c.fullName || c.full_name || c.name || '').trim());
                return (
                  <div className="border-t border-[#EDE7DA] pt-3">
                    <p className="text-xs font-bold text-[#8C8278] uppercase tracking-wider mb-2">Participants Registered</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#f9f6f2]">
                            <th className="px-3 py-2 text-left text-[#8C8278] font-semibold rounded-tl-lg">Ticket #</th>
                            <th className="px-3 py-2 text-left text-[#8C8278] font-semibold">Full Name</th>
                            <th className="px-3 py-2 text-left text-[#8C8278] font-semibold">Gender</th>
                            <th className="px-3 py-2 text-left text-[#8C8278] font-semibold rounded-tr-lg">Age</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filled.map((p, idx) => {
                            const name = (p.fullName || p.full_name || p.name || '').trim();
                            return (
                              <tr key={idx} className="border-t border-[#f0ebe4]">
                                <td className="px-3 py-2 font-mono text-[#C4622D]">{p.ticket_number || '—'}</td>
                                <td className="px-3 py-2 text-[#1A1612] font-medium">{name || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{p.gender || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{p.age != null && p.age !== '' ? String(p.age) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* ── Send Confirmation Modal ── */}
      {previewReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#EDE7DA] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-base font-bold text-[#1A1612]">Class Booking Confirmation Preview</h3>
                <p className="text-xs text-[#8C8278] mt-0.5">Review before confirming for {previewReg.email}</p>
              </div>
              <button onClick={() => { setPreviewReg(null); setSendResult(null); }} className="text-[#8C8278] hover:text-[#1A1612] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6">
              {/* Registration Card Summary */}
              <div className="bg-[#FAF5EE] rounded-2xl border border-[#EDE7DA] p-4 flex flex-col gap-3 mb-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-[#1A1612] text-sm">{previewReg.title ? `${previewReg.title} ` : ''}{previewReg.first_name} {previewReg.surname}</p>
                      <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">Awaiting Confirmation</span>
                    </div>
                    <p className="text-xs text-[#8C8278] font-mono truncate">{previewReg.registration_code || previewReg.id}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-xs text-[#5C5347]">{previewReg.email}</p>
                      <span className="text-[#DDD5C8]">·</span>
                      <p className="text-xs font-semibold text-[#C4622D]">{formatCurrency(previewReg.amount)}</p>
                      <span className="text-[#DDD5C8]">·</span>
                      <p className="text-xs text-[#8C8278]">{formatDate(previewReg.created_at)}</p>
                      <span className="text-[#DDD5C8]">·</span>
                      <p className="text-xs text-[#8C8278]">Cooking Class</p>
                    </div>
                  </div>
                </div>

                {/* Participants Registered */}
                {Array.isArray(previewReg.children) && previewReg.children.filter(c => (c.fullName || c.full_name || c.name || '').trim()).length > 0 && (() => {
                  const filled = previewReg.children!.filter(c => (c.fullName || c.full_name || c.name || '').trim());
                  return (
                    <div className="border-t border-[#EDE7DA] pt-3">
                      <p className="text-xs font-bold text-[#8C8278] uppercase tracking-wider mb-2">Participants Registered</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#f9f6f2]">
                              <th className="px-3 py-2 text-left text-[#8C8278] font-semibold rounded-tl-lg">Ticket #</th>
                              <th className="px-3 py-2 text-left text-[#8C8278] font-semibold">Full Name</th>
                              <th className="px-3 py-2 text-left text-[#8C8278] font-semibold">Gender</th>
                              <th className="px-3 py-2 text-left text-[#8C8278] font-semibold rounded-tr-lg">Age</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filled.map((p, idx) => {
                              const name = (p.fullName || p.full_name || p.name || '').trim();
                              return (
                                <tr key={idx} className="border-t border-[#f0ebe4]">
                                  <td className="px-3 py-2 font-mono text-[#C4622D]">{p.ticket_number || '—'}</td>
                                  <td className="px-3 py-2 text-[#1A1612] font-medium">{name || '—'}</td>
                                  <td className="px-3 py-2 text-[#5C5347]">{p.gender || '—'}</td>
                                  <td className="px-3 py-2 text-[#5C5347]">{p.age != null && p.age !== '' ? String(p.age) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <EmailPreviewBody reg={previewReg} />

              {sendResult && (
                <div className={`mt-4 rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${sendResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {sendResult.success ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" /></svg>
                  )}
                  {sendResult.message}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#EDE7DA] px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => { setPreviewReg(null); setSendResult(null); }}
                disabled={sending}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendConfirmation}
                disabled={sending || (sendResult?.success === true)}
                className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                    Confirming…
                  </>
                ) : sendResult?.success ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Confirmed!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Confirm &amp; Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Confirmation Modal (read-only — Super Admin only) ── */}
      {viewReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#EDE7DA] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1A1612]">Class Booking Confirmation Preview</h3>
                  <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-semibold">Super Admin</span>
                </div>
                <p className="text-xs text-[#8C8278] mt-0.5">Exact confirmation layout the registrant will receive — {viewReg.email}</p>
              </div>
              <button onClick={() => setViewReg(null)} className="text-[#8C8278] hover:text-[#1A1612] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs text-blue-700">This is a read-only preview of the class booking confirmation. Use <strong>Send Confirmation</strong> to dispatch the confirmation and mark the booking as Paid.</p>
            </div>

            <div className="p-6">
              <EmailPreviewBody reg={viewReg} />
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#EDE7DA] px-6 py-4 flex justify-end">
              <button
                onClick={() => setViewReg(null)}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
