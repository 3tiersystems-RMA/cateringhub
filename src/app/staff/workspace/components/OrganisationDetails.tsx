'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgEntity {
  id: string;
  name: string;
  created_at: string;
}

interface BankingDetail {
  id: string;
  entity_id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch_code: string;
  account_type: string | null;
  reference: string | null;
  is_default: boolean;
  created_at: string;
}

interface WarehouseSite {
  id: string;
  entity_id: string;
  name: string;
  address: string;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  created_at: string;
}

interface ContactDetail {
  id: string;
  entity_id: string;
  contact_name: string;
  email: string | null;
  office_number: string | null;
  mobile_number: string | null;
  office_is_default: boolean;
  mobile_is_default: boolean;
  created_at: string;
}

type SectionTab = 'banking' | 'warehouse' | 'contacts';

// ─── Empty forms ──────────────────────────────────────────────────────────────

const emptyBanking: Omit<BankingDetail, 'id' | 'entity_id' | 'created_at'> = {
  bank_name: '',
  account_name: '',
  account_number: '',
  branch_code: '',
  account_type: '',
  reference: '',
  is_default: false,
};

const emptyWarehouse: Omit<WarehouseSite, 'id' | 'entity_id' | 'created_at'> = {
  name: '',
  address: '',
  city: '',
  province: '',
  postal_code: '',
  country: 'South Africa',
  is_default: false,
};

const emptyContact: Omit<ContactDetail, 'id' | 'entity_id' | 'created_at'> = {
  contact_name: '',
  email: '',
  office_number: '',
  mobile_number: '',
  office_is_default: false,
  mobile_is_default: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DefaultBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Default
    </span>
  );
}

function SectionHeader({ title, description, onAdd }: { title: string; description: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h4 className="text-sm font-bold text-[#1A1612]">{title}</h4>
        <p className="text-xs text-[#8C8278] mt-0.5">{description}</p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C4622D] text-white text-xs font-semibold rounded-lg hover:bg-[#A04E22] transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add
      </button>
    </div>
  );
}

// ─── Banking Details Panel ────────────────────────────────────────────────────

function BankingPanel({ entityId }: { entityId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<BankingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BankingDetail | null>(null);
  const [form, setForm] = useState(emptyBanking);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('org_banking_details')
      .select('*')
      .eq('entity_id', entityId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }, [supabase, entityId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(emptyBanking); setError(''); setShowForm(true); };
  const openEdit = (item: BankingDetail) => {
    setEditing(item);
    setForm({ bank_name: item.bank_name, account_name: item.account_name, account_number: item.account_number, branch_code: item.branch_code, account_type: item.account_type || '', reference: item.reference || '', is_default: item.is_default });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim() || !form.branch_code.trim()) {
      setError('Bank name, account name, account number and branch code are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (form.is_default) {
        await supabase.from('org_banking_details').update({ is_default: false }).eq('entity_id', entityId);
      }
      const payload = { entity_id: entityId, bank_name: form.bank_name.trim(), account_name: form.account_name.trim(), account_number: form.account_number.trim(), branch_code: form.branch_code.trim(), account_type: form.account_type?.trim() || null, reference: form.reference?.trim() || null, is_default: form.is_default };
      if (editing) {
        await supabase.from('org_banking_details').update(payload).eq('id', editing.id);
      } else {
        await supabase.from('org_banking_details').insert(payload);
      }
      setShowForm(false);
      load();
    } catch {
      setError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from('org_banking_details').update({ is_default: false }).eq('entity_id', entityId);
    await supabase.from('org_banking_details').update({ is_default: true }).eq('id', id);
    load();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('org_banking_details').delete().eq('id', id);
    setDeletingId(null);
    load();
  };

  if (loading) return <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <SectionHeader title="Banking Details" description="EFT banking accounts used for customer payment correspondence." onAdd={openAdd} />

      {showForm && (
        <div className="mb-4 bg-[#FAF5EE] border border-[#E8DDD0] rounded-xl p-4 space-y-3">
          <h5 className="text-sm font-semibold text-[#1A1612]">{editing ? 'Edit Banking Detail' : 'Add Banking Detail'}</h5>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Bank Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. FNB" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Account Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))} placeholder="e.g. Cardamom Catering" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Account Number <span className="text-red-500">*</span></label>
              <input type="text" value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} placeholder="e.g. 62123456789" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Branch Code <span className="text-red-500">*</span></label>
              <input type="text" value={form.branch_code} onChange={e => setForm(p => ({ ...p, branch_code: e.target.value }))} placeholder="e.g. 250655" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Account Type</label>
              <select value={form.account_type || ''} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]">
                <option value="">Select type</option>
                <option value="Cheque">Cheque</option>
                <option value="Current">Current</option>
                <option value="Savings">Savings</option>
                <option value="Transmission">Transmission</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Payment Reference</label>
              <input type="text" value={form.reference || ''} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="e.g. Order number" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))} className="w-4 h-4 rounded border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]/30" />
            <span className="text-sm text-[#5C5347] font-medium">Set as Default banking account</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#C4622D] text-white text-sm font-semibold rounded-lg hover:bg-[#A04E22] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-white border border-[#DDD5C8] text-[#5C5347] text-sm font-semibold rounded-lg hover:bg-[#F5F0E8] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-[#E8DDD0] rounded-xl">
          <p className="text-2xl mb-1">🏦</p>
          <p className="text-sm text-[#5C5347] font-medium">No banking details yet</p>
          <p className="text-xs text-[#8C8278] mt-0.5">Add a bank account to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className={`border rounded-xl p-4 ${item.is_default ? 'border-green-200 bg-green-50/30' : 'border-[#E8DDD0] bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-semibold text-sm text-[#1A1612]">{item.bank_name}</span>
                    {item.is_default && <DefaultBadge />}
                    {item.account_type && <span className="text-xs text-[#8C8278] bg-[#F5F0E8] border border-[#E8DDD0] px-2 py-0.5 rounded-full">{item.account_type}</span>}
                  </div>
                  {/* EFT-style display matching customer correspondence */}
                  <div className="bg-white border border-[#E8DDD0] rounded-lg p-3 text-xs space-y-1 font-mono">
                    <div className="flex gap-2"><span className="text-[#8C8278] w-28 flex-shrink-0">Account Name:</span><span className="text-[#1A1612] font-semibold">{item.account_name}</span></div>
                    <div className="flex gap-2"><span className="text-[#8C8278] w-28 flex-shrink-0">Account No:</span><span className="text-[#1A1612] font-semibold">{item.account_number}</span></div>
                    <div className="flex gap-2"><span className="text-[#8C8278] w-28 flex-shrink-0">Branch Code:</span><span className="text-[#1A1612]">{item.branch_code}</span></div>
                    {item.reference && <div className="flex gap-2"><span className="text-[#8C8278] w-28 flex-shrink-0">Reference:</span><span className="text-[#1A1612]">{item.reference}</span></div>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {!item.is_default && (
                    <button onClick={() => handleSetDefault(item.id)} className="text-xs text-[#5C5347] border border-[#DDD5C8] px-2.5 py-1 rounded-lg hover:bg-[#F5F0E8] hover:border-[#C4622D] hover:text-[#C4622D] transition-colors whitespace-nowrap">Set Default</button>
                  )}
                  <button onClick={() => openEdit(item)} className="text-xs text-[#5C5347] border border-[#DDD5C8] px-2.5 py-1 rounded-lg hover:bg-[#F5F0E8] transition-colors">Edit</button>
                  <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="text-xs text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                    {deletingId === item.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Warehouse / Site Panel ───────────────────────────────────────────────────

function WarehousePanel({ entityId, allEntityIds }: { entityId: string; allEntityIds: string[] }) {
  const supabase = createClient();
  const [items, setItems] = useState<WarehouseSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WarehouseSite | null>(null);
  const [form, setForm] = useState(emptyWarehouse);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('org_warehouses')
      .select('*')
      .eq('entity_id', entityId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }, [supabase, entityId]);

  useEffect(() => { load(); }, [load]);

  // Check if a default already exists in any OTHER entity across the organisation
  const checkGlobalDefault = useCallback(async (): Promise<{ exists: boolean; entityName?: string }> => {
    if (allEntityIds.length === 0) return { exists: false };
    const otherEntityIds = allEntityIds.filter(id => id !== entityId);
    if (otherEntityIds.length === 0) return { exists: false };
    const { data } = await supabase
      .from('org_warehouses')
      .select('id, entity_id')
      .in('entity_id', otherEntityIds)
      .eq('is_default', true)
      .limit(1);
    return { exists: !!(data && data.length > 0) };
  }, [supabase, entityId, allEntityIds]);

  // Clear defaults across ALL entities in the organisation
  const clearAllDefaults = useCallback(async () => {
    if (allEntityIds.length === 0) return;
    await supabase.from('org_warehouses').update({ is_default: false }).in('entity_id', allEntityIds);
  }, [supabase, allEntityIds]);

  const openAdd = () => { setEditing(null); setForm(emptyWarehouse); setError(''); setShowForm(true); };
  const openEdit = (item: WarehouseSite) => {
    setEditing(item);
    setForm({ name: item.name, address: item.address, city: item.city || '', province: item.province || '', postal_code: item.postal_code || '', country: item.country, is_default: item.is_default });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.address.trim()) {
      setError('Name and address are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (form.is_default) {
        // Check if a default already exists in another entity
        const globalCheck = await checkGlobalDefault();
        if (globalCheck.exists) {
          setError('You can only have one default Warehouse/Site for your Organisation.');
          setSaving(false);
          return;
        }
        // Also check if a different item in THIS entity is already default (and we're not editing it)
        const existingDefault = items.find(i => i.is_default && i.id !== editing?.id);
        if (existingDefault) {
          // Clear all defaults across all entities before setting new one
          await clearAllDefaults();
        } else {
          await clearAllDefaults();
        }
      }
      const payload = { entity_id: entityId, name: form.name.trim(), address: form.address.trim(), city: form.city?.trim() || null, province: form.province?.trim() || null, postal_code: form.postal_code?.trim() || null, country: form.country || 'South Africa', is_default: form.is_default };
      if (editing) {
        await supabase.from('org_warehouses').update(payload).eq('id', editing.id);
      } else {
        await supabase.from('org_warehouses').insert(payload);
      }
      setShowForm(false);
      load();
    } catch {
      setError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    // Block if a default already exists in another entity
    const globalCheck = await checkGlobalDefault();
    if (globalCheck.exists) {
      setError('You can only have one default Warehouse/Site for your Organisation.');
      return;
    }
    // Clear all defaults across all entities, then set this one
    await clearAllDefaults();
    await supabase.from('org_warehouses').update({ is_default: true }).eq('id', id);
    setError('');
    load();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('org_warehouses').delete().eq('id', id);
    setDeletingId(null);
    load();
  };

  if (loading) return <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <SectionHeader title="Warehouses / Sites" description="Physical locations, warehouses or sites associated with this entity." onAdd={openAdd} />

      {showForm && (
        <div className="mb-4 bg-[#FAF5EE] border border-[#E8DDD0] rounded-xl p-4 space-y-3">
          <h5 className="text-sm font-semibold text-[#1A1612]">{editing ? 'Edit Warehouse / Site' : 'Add Warehouse / Site'}</h5>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Site / Warehouse Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Main Warehouse" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Street Address <span className="text-red-500">*</span></label>
              <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="e.g. 12 Main Road" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">City</label>
              <input type="text" value={form.city || ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="e.g. Cape Town" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Province</label>
              <select value={form.province || ''} onChange={e => setForm(p => ({ ...p, province: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]">
                <option value="">Select province</option>
                {['Western Cape','Eastern Cape','Northern Cape','North West','Gauteng','Limpopo','Mpumalanga','Free State','KwaZulu-Natal'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Postal Code</label>
              <input type="text" value={form.postal_code || ''} onChange={e => setForm(p => ({ ...p, postal_code: e.target.value }))} placeholder="e.g. 8001" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Country</label>
              <input type="text" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="South Africa" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))} className="w-4 h-4 rounded border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]/30" />
            <span className="text-sm text-[#5C5347] font-medium">Set as Default warehouse / site</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#C4622D] text-white text-sm font-semibold rounded-lg hover:bg-[#A04E22] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-white border border-[#DDD5C8] text-[#5C5347] text-sm font-semibold rounded-lg hover:bg-[#F5F0E8] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {error && !showForm && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {items.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-[#E8DDD0] rounded-xl">
          <p className="text-2xl mb-1">🏭</p>
          <p className="text-sm text-[#5C5347] font-medium">No warehouses or sites yet</p>
          <p className="text-xs text-[#8C8278] mt-0.5">Add a location to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const isExpanded = item.is_default || expandedIds.has(item.id);
            return (
            <div key={item.id} className={`border rounded-xl overflow-hidden ${item.is_default ? 'border-green-200 bg-green-50/30' : 'border-[#E8DDD0] bg-white'}`}>
              {/* Collapsible header for non-default; always-visible header for default */}
              <div
                className={`flex items-center gap-2 px-4 py-3 ${!item.is_default ? 'cursor-pointer hover:bg-[#FAF5EE] transition-colors' : ''}`}
                onClick={!item.is_default ? () => toggleExpand(item.id) : undefined}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-semibold text-sm text-[#1A1612] truncate">{item.name}</span>
                  {item.is_default && <DefaultBadge />}
                </div>
                {!item.is_default && (
                  <svg
                    className={`w-4 h-4 text-[#8C8278] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className={`px-4 pb-4 ${!item.is_default ? 'border-t border-[#E8DDD0]' : ''}`}>
                  <div className="flex items-start justify-between gap-3 pt-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#5C5347]">{item.address}</p>
                      <p className="text-xs text-[#8C8278]">
                        {[item.city, item.province, item.postal_code, item.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {!item.is_default && (
                        <button onClick={() => handleSetDefault(item.id)} className="text-xs text-[#5C5347] border border-[#DDD5C8] px-2.5 py-1 rounded-lg hover:bg-[#F5F0E8] hover:border-[#C4622D] hover:text-[#C4622D] transition-colors whitespace-nowrap">Set Default</button>
                      )}
                      <button onClick={() => openEdit(item)} className="text-xs text-[#5C5347] border border-[#DDD5C8] px-2.5 py-1 rounded-lg hover:bg-[#F5F0E8] transition-colors">Edit</button>
                      <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="text-xs text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                        {deletingId === item.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsed state: show action buttons inline for non-default */}
              {!isExpanded && !item.is_default && (
                <div className="px-4 pb-3 flex items-center gap-1.5 justify-end">
                  <button onClick={(e) => { e.stopPropagation(); handleSetDefault(item.id); }} className="text-xs text-[#5C5347] border border-[#DDD5C8] px-2.5 py-1 rounded-lg hover:bg-[#F5F0E8] hover:border-[#C4622D] hover:text-[#C4622D] transition-colors whitespace-nowrap">Set Default</button>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="text-xs text-[#5C5347] border border-[#DDD5C8] px-2.5 py-1 rounded-lg hover:bg-[#F5F0E8] transition-colors">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} disabled={deletingId === item.id} className="text-xs text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                    {deletingId === item.id ? '…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Contact Details Panel ────────────────────────────────────────────────────

function ContactsPanel({ entityId }: { entityId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<ContactDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContactDetail | null>(null);
  const [form, setForm] = useState(emptyContact);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('org_contacts')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }, [supabase, entityId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(emptyContact); setError(''); setShowForm(true); };
  const openEdit = (item: ContactDetail) => {
    setEditing(item);
    setForm({ contact_name: item.contact_name, email: item.email || '', office_number: item.office_number || '', mobile_number: item.mobile_number || '', office_is_default: item.office_is_default, mobile_is_default: item.mobile_is_default });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.contact_name.trim()) {
      setError('Contact name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (form.office_is_default) {
        await supabase.from('org_contacts').update({ office_is_default: false }).eq('entity_id', entityId);
      }
      if (form.mobile_is_default) {
        await supabase.from('org_contacts').update({ mobile_is_default: false }).eq('entity_id', entityId);
      }
      const payload = { entity_id: entityId, contact_name: form.contact_name.trim(), email: form.email?.trim() || null, office_number: form.office_number?.trim() || null, mobile_number: form.mobile_number?.trim() || null, office_is_default: form.office_is_default, mobile_is_default: form.mobile_is_default };
      if (editing) {
        await supabase.from('org_contacts').update(payload).eq('id', editing.id);
      } else {
        await supabase.from('org_contacts').insert(payload);
      }
      setShowForm(false);
      load();
    } catch {
      setError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const handleSetOfficeDefault = async (id: string) => {
    await supabase.from('org_contacts').update({ office_is_default: false }).eq('entity_id', entityId);
    await supabase.from('org_contacts').update({ office_is_default: true }).eq('id', id);
    load();
  };

  const handleSetMobileDefault = async (id: string) => {
    await supabase.from('org_contacts').update({ mobile_is_default: false }).eq('entity_id', entityId);
    await supabase.from('org_contacts').update({ mobile_is_default: true }).eq('id', id);
    load();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('org_contacts').delete().eq('id', id);
    setDeletingId(null);
    load();
  };

  if (loading) return <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <SectionHeader title="Main Contact Details" description="Primary contacts per entity — name, email and phone numbers." onAdd={openAdd} />

      {showForm && (
        <div className="mb-4 bg-[#FAF5EE] border border-[#E8DDD0] rounded-xl p-4 space-y-3">
          <h5 className="text-sm font-semibold text-[#1A1612]">{editing ? 'Edit Contact' : 'Add Contact'}</h5>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Contact Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} placeholder="e.g. Jane Smith" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Email Address</label>
              <input type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="e.g. jane@company.co.za" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Office Number</label>
              <input type="tel" value={form.office_number || ''} onChange={e => setForm(p => ({ ...p, office_number: e.target.value }))} placeholder="e.g. 021 123 4567" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Mobile Number</label>
              <input type="tel" value={form.mobile_number || ''} onChange={e => setForm(p => ({ ...p, mobile_number: e.target.value }))} placeholder="e.g. 082 123 4567" className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]" />
            </div>
          </div>
          <div className="space-y-2 pt-1">
            {form.office_number && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.office_is_default} onChange={e => setForm(p => ({ ...p, office_is_default: e.target.checked }))} className="w-4 h-4 rounded border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]/30" />
                <span className="text-sm text-[#5C5347] font-medium">Set office number as Default</span>
              </label>
            )}
            {form.mobile_number && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.mobile_is_default} onChange={e => setForm(p => ({ ...p, mobile_is_default: e.target.checked }))} className="w-4 h-4 rounded border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]/30" />
                <span className="text-sm text-[#5C5347] font-medium">Set mobile number as Default</span>
              </label>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#C4622D] text-white text-sm font-semibold rounded-lg hover:bg-[#A04E22] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-white border border-[#DDD5C8] text-[#5C5347] text-sm font-semibold rounded-lg hover:bg-[#F5F0E8] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-[#E8DDD0] rounded-xl">
          <p className="text-2xl mb-1">👤</p>
          <p className="text-sm text-[#5C5347] font-medium">No contacts yet</p>
          <p className="text-xs text-[#8C8278] mt-0.5">Add a main contact to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="border border-[#E8DDD0] bg-white rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#1A1612] mb-2">{item.contact_name}</p>
                  {item.email && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#C4622D] text-xs">✉</span>
                      <span className="text-xs text-[#5C5347]">{item.email}</span>
                    </div>
                  )}
                  {item.office_number && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#C4622D] text-xs">📞</span>
                      <span className="text-xs text-[#5C5347]">{item.office_number}</span>
                      <span className="text-xs text-[#8C8278]">(Office)</span>
                      {item.office_is_default && <DefaultBadge />}
                      {!item.office_is_default && (
                        <button onClick={() => handleSetOfficeDefault(item.id)} className="text-xs text-[#C4622D] hover:underline">Set Default</button>
                      )}
                    </div>
                  )}
                  {item.mobile_number && (
                    <div className="flex items-center gap-2">
                      <span className="text-[#C4622D] text-xs">📱</span>
                      <span className="text-xs text-[#5C5347]">{item.mobile_number}</span>
                      <span className="text-xs text-[#8C8278]">(Mobile)</span>
                      {item.mobile_is_default && <DefaultBadge />}
                      {!item.mobile_is_default && (
                        <button onClick={() => handleSetMobileDefault(item.id)} className="text-xs text-[#C4622D] hover:underline">Set Default</button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(item)} className="text-xs text-[#5C5347] border border-[#DDD5C8] px-2.5 py-1 rounded-lg hover:bg-[#F5F0E8] transition-colors">Edit</button>
                  <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="text-xs text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                    {deletingId === item.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Entity Card ──────────────────────────────────────────────────────────────

function EntityCard({ entity, onDelete, onEditName, allEntityIds, hasDefaultWarehouse }: { entity: OrgEntity; onDelete: (id: string) => void; onEditName: (entity: OrgEntity) => void; allEntityIds: string[]; hasDefaultWarehouse: boolean }) {
  const [activeSection, setActiveSection] = useState<SectionTab>('banking');
  const [isOpen, setIsOpen] = useState(hasDefaultWarehouse);

  const sectionTabs: { key: SectionTab; label: string; icon: string }[] = [
    { key: 'banking', label: 'Banking Details', icon: '🏦' },
    { key: 'warehouse', label: 'Warehouses / Sites', icon: '🏭' },
    { key: 'contacts', label: 'Main Contacts', icon: '👤' },
  ];

  return (
    <div className="bg-white border border-[#E8DDD0] rounded-2xl overflow-hidden">
      {/* Entity header */}
      <div
        className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#FAF5EE] to-[#F5EFE8] border-b border-[#E8DDD0] cursor-pointer select-none"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C4622D] to-[#E8845A] flex items-center justify-center text-white text-sm font-bold shadow-sm">
            {entity.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1A1612]">{entity.name}</h3>
            <p className="text-xs text-[#8C8278]">Entity</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEditName(entity); }}
            className="text-xs text-[#C4622D] border border-[#C4622D]/30 px-2.5 py-1 rounded-lg hover:bg-[#FAF5EE] transition-colors"
          >
            Edit Name
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(entity.id); }}
            className="text-xs text-red-500 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
          >
            Remove Entity
          </button>
          <svg
            className={`w-4 h-4 text-[#8C8278] transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Section tabs */}
          <div className="flex border-b border-[#E8DDD0] overflow-x-auto">
            {sectionTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeSection === tab.key
                    ? 'border-[#C4622D] text-[#C4622D] bg-[#FDF6EE]'
                    : 'border-transparent text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="p-5">
            {activeSection === 'banking' && <BankingPanel entityId={entity.id} />}
            {activeSection === 'warehouse' && <WarehousePanel entityId={entity.id} allEntityIds={allEntityIds} />}
            {activeSection === 'contacts' && <ContactsPanel entityId={entity.id} />}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrganisationDetails() {
  const supabase = createClient();
  const [entities, setEntities] = useState<OrgEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [addingEntity, setAddingEntity] = useState(false);
  const [addEntityError, setAddEntityError] = useState('');
  const [deletingEntityId, setDeletingEntityId] = useState<string | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editingEntityName, setEditingEntityName] = useState('');
  const [savingEntityName, setSavingEntityName] = useState(false);
  const [editEntityError, setEditEntityError] = useState('');
  // Track which entity IDs have a default warehouse/site
  const [entityIdsWithDefaultWarehouse, setEntityIdsWithDefaultWarehouse] = useState<Set<string>>(new Set());

  const loadEntities = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('org_entities')
      .select('*')
      .order('created_at', { ascending: true });
    const entityList = data || [];
    setEntities(entityList);

    // Load which entities have a default warehouse/site
    if (entityList.length > 0) {
      const entityIds = entityList.map((e: OrgEntity) => e.id);
      const { data: defaultWarehouses } = await supabase
        .from('org_warehouses')
        .select('entity_id')
        .in('entity_id', entityIds)
        .eq('is_default', true);
      const withDefault = new Set<string>((defaultWarehouses || []).map((w: { entity_id: string }) => w.entity_id));
      setEntityIdsWithDefaultWarehouse(withDefault);
    } else {
      setEntityIdsWithDefaultWarehouse(new Set());
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadEntities(); }, [loadEntities]);

  const handleAddEntity = async () => {
    if (!newEntityName.trim()) { setAddEntityError('Entity name is required.'); return; }
    setAddingEntity(true);
    setAddEntityError('');
    const { error } = await supabase.from('org_entities').insert({ name: newEntityName.trim() });
    if (error) { setAddEntityError('Failed to add entity: ' + error.message); }
    else { setNewEntityName(''); setShowAddEntity(false); loadEntities(); }
    setAddingEntity(false);
  };

  const handleDeleteEntity = async (id: string) => {
    if (!confirm('Remove this entity and all its details? This cannot be undone.')) return;
    setDeletingEntityId(id);
    await supabase.from('org_entities').delete().eq('id', id);
    setDeletingEntityId(null);
    loadEntities();
  };

  const handleEditEntityStart = (entity: OrgEntity) => {
    setEditingEntityId(entity.id);
    setEditingEntityName(entity.name);
    setEditEntityError('');
  };

  const handleEditEntitySave = async () => {
    if (!editingEntityName.trim()) { setEditEntityError('Entity name is required.'); return; }
    setSavingEntityName(true);
    setEditEntityError('');
    const { error } = await supabase.from('org_entities').update({ name: editingEntityName.trim() }).eq('id', editingEntityId!);
    if (error) { setEditEntityError('Failed to update: ' + error.message); }
    else { setEditingEntityId(null); setEditingEntityName(''); loadEntities(); }
    setSavingEntityName(false);
  };

  const handleEditEntityCancel = () => {
    setEditingEntityId(null);
    setEditingEntityName('');
    setEditEntityError('');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="flex items-center gap-2 text-[#8C8278]">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading organisation details…</span>
        </div>
      </div>
    );
  }

  const allEntityIds = entities.map(e => e.id);

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#2C2420]">Organisation Details</h2>
          <p className="text-sm text-[#8C7B6B] mt-0.5">Manage banking details, warehouses/sites and main contacts per entity.</p>
        </div>
        <button
          onClick={() => { setShowAddEntity(true); setAddEntityError(''); setNewEntityName(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#C4622D] text-white text-sm font-semibold rounded-xl hover:bg-[#A04E22] transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Entity
        </button>
      </div>

      {/* Add entity form */}
      {showAddEntity && (
        <div className="bg-[#FAF5EE] border border-[#E8DDD0] rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-[#1A1612]">New Entity</h4>
          {addEntityError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addEntityError}</p>}
          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Entity Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newEntityName}
              onChange={e => setNewEntityName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddEntity()}
              placeholder="e.g. Cardamom Catering (Pty) Ltd"
              className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddEntity} disabled={addingEntity} className="px-4 py-2 bg-[#C4622D] text-white text-sm font-semibold rounded-lg hover:bg-[#A04E22] transition-colors disabled:opacity-50">
              {addingEntity ? 'Adding…' : 'Add Entity'}
            </button>
            <button onClick={() => setShowAddEntity(false)} className="px-4 py-2 bg-white border border-[#DDD5C8] text-[#5C5347] text-sm font-semibold rounded-lg hover:bg-[#F5F0E8] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Entities list */}
      {entities.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#E8DDD0] rounded-2xl">
          <p className="text-4xl mb-3">🏢</p>
          <p className="text-[#5C5347] font-semibold text-base">No entities yet</p>
          <p className="text-sm text-[#8C8278] mt-1 mb-4">Add your first entity to manage banking details, warehouses and contacts.</p>
          <button
            onClick={() => { setShowAddEntity(true); setAddEntityError(''); setNewEntityName(''); }}
            className="px-5 py-2.5 bg-[#C4622D] text-white text-sm font-semibold rounded-xl hover:bg-[#A04E22] transition-colors"
          >
            Add First Entity
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {entities.map(entity => (
            <div key={entity.id} className={deletingEntityId === entity.id ? 'opacity-50 pointer-events-none' : ''}>
              {/* Inline entity name edit */}
              {editingEntityId === entity.id ? (
                <div className="bg-[#FAF5EE] border border-[#E8DDD0] rounded-xl p-4 space-y-3 mb-2">
                  <h4 className="text-sm font-semibold text-[#1A1612]">Edit Entity Name</h4>
                  {editEntityError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editEntityError}</p>}
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Entity Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingEntityName}
                      onChange={e => setEditingEntityName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditEntitySave(); if (e.key === 'Escape') handleEditEntityCancel(); }}
                      autoFocus
                      className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleEditEntitySave} disabled={savingEntityName} className="px-4 py-2 bg-[#C4622D] text-white text-sm font-semibold rounded-lg hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                      {savingEntityName ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={handleEditEntityCancel} className="px-4 py-2 bg-white border border-[#DDD5C8] text-[#5C5347] text-sm font-semibold rounded-lg hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                  </div>
                </div>
              ) : null}
              <EntityCard
                entity={entity}
                onDelete={handleDeleteEntity}
                onEditName={handleEditEntityStart}
                allEntityIds={allEntityIds}
                hasDefaultWarehouse={entityIdsWithDefaultWarehouse.has(entity.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
