'use client';

import { useState, useRef, useEffect } from 'react';
import {
  type ConfirmationEmailRecipientsMap,
  type ConfirmationRecipientKey,
  type ResolvedRecipient,
  type RecipientUiStatus,
  formatRecipientUiStatus,
  getRecipientStatusBadgeClass,
  resolveConfirmationRecipients,
} from '@/lib/confirmation-email-recipients';

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatRegistrantBadge(status: RecipientUiStatus): string {
  switch (status) {
    case 'sent':
      return 'Notified';
    case 'failed':
      return 'Failed';
    case 'pending':
      return 'Pending';
    default:
      return '—';
  }
}

const RECIPIENT_ICONS: Record<ConfirmationRecipientKey, string> = {
  customer: '👤',
  info_admin: '📋',
  main_admin: '🛡️',
};

interface ConfirmationEmailRecipientStatusProps {
  customerEmail: string;
  infoEmail: string | null;
  mainAdminEmail: string | null;
  storedRecipients?: ConfirmationEmailRecipientsMap | null;
  legacySentAt?: string | null;
  legacyResendId?: string | null;
}

export function ConfirmationEmailRecipientStatus({
  customerEmail,
  infoEmail,
  mainAdminEmail,
  storedRecipients,
  legacySentAt,
  legacyResendId,
}: ConfirmationEmailRecipientStatusProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolved = resolveConfirmationRecipients(
    storedRecipients,
    customerEmail,
    infoEmail,
    mainAdminEmail,
    legacySentAt,
    legacyResendId
  );
  const applicable = resolved.filter((r) => r.status !== 'not_applicable' && r.email);
  const registrant = resolved.find((r) => r.key === 'customer');
  const registrantStatus = registrant?.status ?? 'pending';
  const adminRecipients = applicable.filter((r) => r.key !== 'customer');

  const showPopover = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setOpen(true);
  };

  const hidePopover = () => {
    leaveTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  if (!registrant?.email) {
    return <span className="text-[#8C7B6B]">—</span>;
  }

  if (registrantStatus === 'not_applicable') {
    return <span className="text-[#8C7B6B]">—</span>;
  }

  return (
    <div
      ref={wrapRef}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={showPopover}
      onMouseLeave={hidePopover}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-transparent hover:border-[#E8DDD0] hover:bg-[#FAF5EE] px-1.5 py-1 -mx-1.5 transition-colors"
        title="Registrant email status — hover or click for all recipients"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span
          className={`inline-flex w-fit shrink-0 px-2 py-0.5 text-xs font-medium rounded-full border ${getRecipientStatusBadgeClass(registrantStatus)}`}
        >
          {formatRegistrantBadge(registrantStatus)}
        </span>
        {applicable.length > 1 && (
          <svg
            className="w-3.5 h-3.5 text-[#C4B8A8] group-hover:text-[#8C7B6B]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      {open && applicable.length > 0 && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-[#E8DDD0] bg-white shadow-xl shadow-black/10 p-3"
          onMouseEnter={showPopover}
          onMouseLeave={hidePopover}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8C7B6B] mb-2">
            All confirmation recipients
          </p>
          <div className="space-y-2">
            {registrant && registrant.email && (
              <RecipientPopoverRow recipient={registrant} emphasize />
            )}
            {adminRecipients.length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#C4B8A8] pt-0.5">
                  Admin copies
                </p>
                {adminRecipients.map((r) => (
                  <RecipientPopoverRow key={r.key} recipient={r} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RecipientPopoverRow({
  recipient,
  emphasize = false,
}: {
  recipient: ResolvedRecipient;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        emphasize ? 'border-[#E8C9B0] bg-[#FDF6EE]' : 'border-[#F0E8DE] bg-[#FAF5EE]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#5C5347] flex items-center gap-1">
            <span>{RECIPIENT_ICONS[recipient.key]}</span>
            {recipient.label}
          </p>
          <p className="text-xs text-[#2C2420] truncate mt-0.5">{recipient.email}</p>
          {recipient.sent_at && (
            <p className="text-[10px] text-[#8C7B6B] mt-0.5">Sent {formatShortDate(recipient.sent_at)}</p>
          )}
          {recipient.error && (
            <p className="text-[10px] text-red-600 mt-0.5 line-clamp-2" title={recipient.error}>
              {recipient.error}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full border ${getRecipientStatusBadgeClass(recipient.status)}`}
        >
          {formatRecipientUiStatus(recipient.status)}
        </span>
      </div>
    </div>
  );
}

export interface SendRecipientOption {
  key: ConfirmationRecipientKey;
  label: string;
  email: string;
  status: ResolvedRecipient['status'];
  sent_at: string | null;
}

export function buildSendRecipientOptions(
  resolved: ResolvedRecipient[]
): SendRecipientOption[] {
  return resolved
    .filter((r) => r.email && r.status !== 'not_applicable')
    .map((r) => ({
      key: r.key,
      label: r.label,
      email: r.email as string,
      status: r.status,
      sent_at: r.sent_at,
    }));
}

export function defaultSelectedRecipientKeys(options: SendRecipientOption[]): ConfirmationRecipientKey[] {
  const pendingOrFailed = options.filter((o) => o.status !== 'sent').map((o) => o.key);
  if (pendingOrFailed.length > 0) return pendingOrFailed;
  return [];
}

interface RecipientCheckboxListProps {
  options: SendRecipientOption[];
  selected: ConfirmationRecipientKey[];
  onChange: (keys: ConfirmationRecipientKey[]) => void;
}

export function RecipientCheckboxList({
  options,
  selected,
  onChange,
}: RecipientCheckboxListProps) {
  const toggle = (key: ConfirmationRecipientKey) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isChecked = selected.includes(opt.key);
        const isNotified = opt.status === 'sent';
        return (
          <label
            key={opt.key}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
              isChecked
                ? 'border-[#C4622D] bg-[#FDF6EE]'
                : 'border-[#E8DDD0] bg-white hover:bg-[#FAF5EE]'
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={isChecked}
              onChange={() => toggle(opt.key)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#5C5347]">
                  {RECIPIENT_ICONS[opt.key]} {opt.label}
                </span>
                {isNotified && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-green-50 text-green-700 border border-green-200">
                    ✓ Notified
                    {opt.sent_at ? ` · ${formatShortDate(opt.sent_at)}` : ''}
                  </span>
                )}
                {opt.status === 'failed' && (
                  <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-50 text-red-700 border border-red-200">
                    Failed
                  </span>
                )}
                {opt.status === 'pending' && !isNotified && (
                  <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    Pending
                  </span>
                )}
              </div>
              <p className="text-sm text-[#1A1612] truncate mt-0.5">{opt.email}</p>
              {isNotified && (
                <p className="text-[10px] text-[#8C7B6B] mt-0.5">
                  Check to resend if this person did not receive the email.
                </p>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
