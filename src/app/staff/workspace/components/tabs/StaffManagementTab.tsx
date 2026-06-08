'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import type { StaffRole } from '@/app/staff/workspace/rbac';
import type { StaffMember } from '../../types';

const emptyInviteForm = {
  full_name: '',
  email: '',
  phone_number: '',
  role: 'staff' as StaffRole,
};

function RoleBadge({ role }: { role: StaffRole }) {
  const config: Record<StaffRole, { label: string; className: string }> = {
    super_admin: { label: 'Super Admin', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
    admin: { label: 'Admin', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
    staff: { label: 'Staff', className: 'bg-[#e9e0cf] text-[#5C5347] border border-[#DDD5C8]' },
  };
  const { label, className } = config[role] || config.staff;
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${className}`}>{label}</span>
  );
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

interface StaffManagementTabProps {
  can: (action: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

export default function StaffManagementTab({ can }: StaffManagementTabProps) {
  const supabase = createClient();

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [togglingStaffId, setTogglingStaffId] = useState<string | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sendingResetId, setSendingResetId] = useState<string | null>(null);
  const [resetMessages, setResetMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<StaffMember | null>(null);
  const [deleteActiveMember, setDeleteActiveMember] = useState<StaffMember | null>(null);
  const [editMenuOpenId, setEditMenuOpenId] = useState<string | null>(null);
  const [editModalMember, setEditModalMember] = useState<StaffMember | null>(null);
  const [editModalForm, setEditModalForm] = useState({ full_name: '', phone: '', role: 'staff' as StaffRole });
  const [editModalSaving, setEditModalSaving] = useState(false);
  const [editModalError, setEditModalError] = useState('');
  const [promoteForm, setPromoteForm] = useState({ email: '', full_name: '', phone_number: '', role: 'staff' as StaffRole });
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState('');
  const [promoteSuccess, setPromoteSuccess] = useState('');
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');
  const [actionMessages, setActionMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deactivatingForDeleteId, setDeactivatingForDeleteId] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState('');

  const showActionMessage = (id: string, type: 'success' | 'error', text: string) => {
    setActionMessages((prev) => ({ ...prev, [id]: { type, text } }));
    window.setTimeout(() => {
      setActionMessages((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 4000);
  };

  const loadStaff = async () => {
    setStaffLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    if (data) setStaffMembers(data.filter(m => m.role !== 'super_admin'));
    setStaffLoading(false);
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleInviteStaff = async () => {
    const full_name = inviteForm.full_name.trim();
    const email = inviteForm.email.trim().toLowerCase();

    if (!full_name || !email) {
      setInviteError('Name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Please enter a valid email address.');
      return;
    }

    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...inviteForm, full_name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to invite staff');

      setInviteSuccess(data.message || 'Invitation sent successfully.');
      setInviteForm(emptyInviteForm);
      await loadStaff();

      window.setTimeout(() => {
        setInviteOpen(false);
        setInviteSuccess('');
      }, 2500);
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite staff');
    } finally {
      setInviting(false);
    }
  };

  const handlePromoteUser = async () => {
    const email = promoteForm.email.trim().toLowerCase();
    const full_name = promoteForm.full_name.trim();
    const phone_number = promoteForm.phone_number.trim();

    if (!email) {
      setPromoteError('Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPromoteError('Please enter a valid email address.');
      return;
    }

    setPromoting(true);
    setPromoteError('');
    setPromoteSuccess('');

    try {
      const res = await fetch('/api/staff/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email,
          full_name,
          phone_number,
          role: promoteForm.role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data.error || 'Failed to promote user';
        if (res.status === 404 && errMsg.toLowerCase().includes('invite')) {
          setPromoteError(errMsg);
          setInviteForm({
            full_name: full_name || '',
            email,
            phone_number,
            role: promoteForm.role,
          });
        }
        throw new Error(errMsg);
      }

      setPromoteSuccess(data.message || 'User promoted to staff!');
      setPromoteForm({ email: '', full_name: '', phone_number: '', role: 'staff' });
      await loadStaff();

      window.setTimeout(() => {
        setPromoteOpen(false);
        setPromoteSuccess('');
      }, 2500);
    } catch (err: unknown) {
      setPromoteError(err instanceof Error ? err.message : 'Failed to promote user');
    } finally {
      setPromoting(false);
    }
  };

  const handleResetPassword = async (member: StaffMember) => {
    setSendingResetId(member.id);
    setEditMenuOpenId(null);

    try {
      const res = await fetch('/api/staff/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: member.email, full_name: member.full_name }),
      });
      const data = await res.json().catch(() => ({}));
      setResetMessages((prev) => ({
        ...prev,
        [member.id]: {
          type: res.ok ? 'success' : 'error',
          text: res.ok ? 'Reset email sent!' : (data.error || 'Failed'),
        },
      }));
      window.setTimeout(() => {
        setResetMessages((prev) => {
          const next = { ...prev };
          delete next[member.id];
          return next;
        });
      }, 4000);
    } catch {
      setResetMessages((prev) => ({
        ...prev,
        [member.id]: { type: 'error', text: 'Failed to send' },
      }));
    } finally {
      setSendingResetId(null);
    }
  };

  const confirmDeleteStaff = async () => {
    if (!deleteConfirmMember) return;
    const member = deleteConfirmMember;
    setDeletingId(member.id);

    try {
      const res = await fetch('/api/staff/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: member.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDeleteConfirmMember(null);
        showActionMessage(member.id, 'error', data.error || 'Failed to delete');
        return;
      }

      setDeleteConfirmMember(null);
      setDeleteSuccessMessage(data.message || `${member.full_name} has been deleted.`);
      window.setTimeout(() => setDeleteSuccessMessage(''), 4000);
      await loadStaff();
    } catch {
      setDeleteConfirmMember(null);
      showActionMessage(member.id, 'error', 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeactivateThenDelete = async () => {
    if (!deleteActiveMember) return;
    const member = deleteActiveMember;
    setDeactivatingForDeleteId(member.id);

    try {
      const res = await fetch('/api/staff/toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: member.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showActionMessage(member.id, 'error', data.error || 'Failed to deactivate');
        return;
      }

      setDeleteActiveMember(null);
      await loadStaff();
      setDeleteConfirmMember({ ...member, is_active: false });
    } catch {
      showActionMessage(member.id, 'error', 'Failed to deactivate');
    } finally {
      setDeactivatingForDeleteId(null);
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    setTogglingStaffId(member.id);
    setEditMenuOpenId(null);

    try {
      const res = await fetch('/api/staff/toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: member.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showActionMessage(member.id, 'error', data.error || 'Failed to update status');
        return;
      }

      showActionMessage(member.id, 'success', data.message || 'Status updated');
      await loadStaff();
    } catch {
      showActionMessage(member.id, 'error', 'Failed to update status');
    } finally {
      setTogglingStaffId(null);
    }
  };

  const handleSaveEditModal = async () => {
    if (!editModalMember) return;
    if (!editModalForm.full_name.trim()) {
      setEditModalError('Name is required.');
      return;
    }

    setEditModalSaving(true);
    setEditModalError('');

    try {
      const res = await fetch('/api/staff/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          id: editModalMember.id,
          full_name: editModalForm.full_name.trim(),
          phone: editModalForm.phone.trim(),
          role: editModalForm.role,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEditModalError(data.error || 'Failed to save changes');
        return;
      }

      setEditModalMember(null);
      await loadStaff();
      showActionMessage(editModalMember.id, 'success', 'Details saved');
    } catch {
      setEditModalError('Failed to save changes');
    } finally {
      setEditModalSaving(false);
    }
  };

  const filteredStaff = staffMembers.filter(m => {
    const q = staffSearchQuery.toLowerCase();
    const matchSearch = !q || m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    const matchStatus = staffStatusFilter === 'all' || (staffStatusFilter === 'active' ? m.is_active : !m.is_active);
    return matchSearch && matchStatus;
  });

  return (
    <>
      <VoucherErrorModal
        isOpen={!!globalError}
        title={globalErrorTitle || 'Error'}
        message={globalError}
        onClose={() => { setGlobalError(''); setGlobalErrorTitle(''); }}
      />

      <ModalPortal>
        {deleteActiveMember && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDeleteActiveMember(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-[#1A1612] mb-2">Cannot Delete Active Staff</h3>
              <p className="text-sm text-[#5C4F3D] mb-5">
                <span className="font-semibold">{deleteActiveMember.full_name}</span> must be deactivated before they can be deleted.
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteActiveMember(null)}
                  className="px-4 py-2 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C4F3D] hover:bg-[#F5F0E8] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeactivateThenDelete}
                  disabled={!!deactivatingForDeleteId}
                  className="px-4 py-2 rounded-xl bg-[#C4622D] text-white text-sm font-semibold hover:bg-[#A8501F] transition-colors disabled:opacity-50"
                >
                  {deactivatingForDeleteId ? 'Deactivating…' : 'Deactivate & Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteConfirmMember && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !deletingId && setDeleteConfirmMember(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-[#1A1612] mb-2">Delete Staff Member</h3>
              <p className="text-sm text-[#5C4F3D] mb-1">
                Are you sure you want to permanently delete <span className="font-semibold">{deleteConfirmMember.full_name}</span>?
              </p>
              <p className="text-xs text-red-500 mb-5">This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmMember(null)}
                  disabled={!!deletingId}
                  className="px-4 py-2 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C4F3D] hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteStaff}
                  disabled={!!deletingId}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deletingId ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalPortal>

      {editModalMember && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !editModalSaving && setEditModalMember(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#1A1612] mb-5">Edit Staff Member</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Email</label>
                <input type="email" value={editModalMember.email} readOnly className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm bg-[#FAF5EE] text-[#8C8278] cursor-not-allowed focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Full Name *</label>
                <input type="text" value={editModalForm.full_name} onChange={e => setEditModalForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Phone Number</label>
                <input type="tel" value={editModalForm.phone} onChange={e => setEditModalForm(f => ({ ...f, phone: e.target.value }))} placeholder="+27..." className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Role</label>
                <select value={editModalForm.role} onChange={e => setEditModalForm(f => ({ ...f, role: e.target.value as StaffRole }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {editModalError && <p className="text-sm text-red-600 mt-3">{editModalError}</p>}
            <div className="flex items-center gap-3 mt-5">
              <button type="button" onClick={handleSaveEditModal} disabled={editModalSaving} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{editModalSaving ? 'Saving…' : 'Save Changes'}</button>
              <button type="button" onClick={() => setEditModalMember(null)} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      <div className="p-6">
        {deleteSuccessMessage && (
          <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
            {deleteSuccessMessage}
          </div>
        )}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1A1612]">Staff Management</h2>
            <p className="text-sm text-[#8C8278] mt-0.5">{staffMembers.length} staff members</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="text" placeholder="Search staff…" value={staffSearchQuery} onChange={e => setStaffSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
            <select value={staffStatusFilter} onChange={e => setStaffStatusFilter(e.target.value as 'all' | 'active' | 'inactive')} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {can('create') && (
              <button
                type="button"
                onClick={() => {
                  setPromoteOpen(false);
                  setPromoteError('');
                  setPromoteSuccess('');
                  setInviteError('');
                  setInviteSuccess('');
                  setInviteOpen(true);
                }}
                className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
              >
                + Invite Staff
              </button>
            )}
            {can('create') && (
              <button
                type="button"
                onClick={() => {
                  setInviteOpen(false);
                  setInviteError('');
                  setInviteSuccess('');
                  setPromoteError('');
                  setPromoteSuccess('');
                  setPromoteOpen(true);
                }}
                className="border border-[#C4622D] text-[#C4622D] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#FDF6EE] transition-colors"
              >
                Promote Existing User
              </button>
            )}
          </div>
        </div>
        {inviteOpen && (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5 mb-5">
            <h3 className="text-sm font-bold text-[#1A1612] mb-3">Invite New Staff Member</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Full Name *</label><input type="text" value={inviteForm.full_name} onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
              <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Email *</label><input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
              <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Phone</label><input type="tel" value={inviteForm.phone_number} onChange={e => setInviteForm(f => ({ ...f, phone_number: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
              <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Role</label><select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as StaffRole }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
            </div>
            {inviteError && <p className="text-sm text-red-600 mb-2">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-600 mb-2">{inviteSuccess}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={handleInviteStaff} disabled={inviting} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{inviting ? 'Sending…' : 'Send Invite'}</button>
              <button type="button" onClick={() => { setInviteOpen(false); setInviteError(''); setInviteSuccess(''); }} className="px-5 py-2 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
            </div>
          </div>
        )}
        {promoteOpen && (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5 mb-5">
            <h3 className="text-sm font-bold text-[#1A1612] mb-3">Promote Existing User to Staff</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Email *</label><input type="email" value={promoteForm.email} onChange={e => setPromoteForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
              <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Full Name</label><input type="text" value={promoteForm.full_name} onChange={e => setPromoteForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Uses account name if blank" className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
              <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Phone</label><input type="tel" value={promoteForm.phone_number} onChange={e => setPromoteForm(f => ({ ...f, phone_number: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
              <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Role</label><select value={promoteForm.role} onChange={e => setPromoteForm(f => ({ ...f, role: e.target.value as StaffRole }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
            </div>
            {promoteError && <p className="text-sm text-red-600 mb-2">{promoteError}</p>}
            {promoteSuccess && <p className="text-sm text-green-600 mb-2">{promoteSuccess}</p>}
            <div className="flex gap-3 flex-wrap">
              <button type="button" onClick={handlePromoteUser} disabled={promoting} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{promoting ? 'Promoting…' : 'Promote User'}</button>
              {promoteError && promoteError.toLowerCase().includes('invite') && (
                <button
                  type="button"
                  onClick={() => {
                    setPromoteOpen(false);
                    setPromoteError('');
                    setInviteError('');
                    setInviteSuccess('');
                    setInviteOpen(true);
                  }}
                  className="border border-[#C4622D] text-[#C4622D] px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#FDF6EE] transition-colors"
                >
                  Switch to Invite Staff
                </button>
              )}
              <button type="button" onClick={() => { setPromoteOpen(false); setPromoteError(''); setPromoteSuccess(''); }} className="px-5 py-2 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
            </div>
            <p className="text-xs text-[#8C8278] mt-3">
              Promote only works if the person already has a login account (e.g. existing customer). New emails must use <strong>+ Invite Staff</strong>.
            </p>
          </div>
        )}
        {staffLoading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {filteredStaff.map(m => (
              <div key={m.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1"><p className="font-semibold text-[#1A1612]">{m.full_name}</p><RoleBadge role={m.role} /></div>
                  <p className="text-xs text-[#8C8278]">{m.email}{m.phone ? ` · ${m.phone}` : ''}</p>
                  <p className="text-xs text-[#8C8278]">Joined {formatDate(m.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{m.is_active ? 'Active' : 'Inactive'}</span>
                  {(resetMessages[m.id] || actionMessages[m.id]) && (
                    <span className={`text-xs font-medium ${(resetMessages[m.id] || actionMessages[m.id]).type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {(resetMessages[m.id] || actionMessages[m.id]).text}
                    </span>
                  )}
                  {can('edit') && (
                    <div className="relative">
                      <button type="button" onClick={() => setEditMenuOpenId(editMenuOpenId === m.id ? null : m.id)} className="text-xs border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FAF5EE] transition-colors">Actions ▾</button>
                      {editMenuOpenId === m.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-[#DDD5C8] rounded-xl shadow-lg z-10 min-w-[160px] py-1">
                          <button type="button" onClick={() => { setEditModalMember(m); setEditModalForm({ full_name: m.full_name, phone: m.phone || '', role: m.role }); setEditModalError(''); setEditMenuOpenId(null); }} className="w-full text-left px-4 py-2 text-sm text-[#1A1612] hover:bg-[#FAF5EE]">Edit Details</button>
                          <button type="button" onClick={() => handleToggleActive(m)} disabled={togglingStaffId === m.id} className="w-full text-left px-4 py-2 text-sm text-[#1A1612] hover:bg-[#FAF5EE] disabled:opacity-50">{togglingStaffId === m.id ? 'Updating…' : (m.is_active ? 'Deactivate' : 'Activate')}</button>
                          <button type="button" onClick={() => handleResetPassword(m)} disabled={sendingResetId === m.id} className="w-full text-left px-4 py-2 text-sm text-[#1A1612] hover:bg-[#FAF5EE] disabled:opacity-50">{sendingResetId === m.id ? 'Sending…' : 'Reset Password'}</button>
                          {can('delete') && <button type="button" onClick={() => { setEditMenuOpenId(null); if (m.is_active) { setDeleteActiveMember(m); } else { setDeleteConfirmMember(m); } }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {staffMembers.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No staff members found.</p></div>}
          </div>
        )}
      </div>
    </>
  );
}
