'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
  category?: string;
  package_type?: string;
}

interface ProductsOrderedRow {
  orderId: string;
  productName: string;
  productType: string;
  item: string;
  mealVoucher: string | null;
  discountVoucher: string | null;
  orderedDate: string;
  orderedRaw: string;
  deliveredDt: string;
  deliveredRaw: string;
  clientName: string;
  clientEmail: string;
}

interface PackageMealsOrderedRow {
  orderId: string;
  productName: string;
  productType: string;
  item: string;
  packagePurchased: string;
  mealVoucher: string | null;
  discountVoucher: string | null;
  orderedDate: string;
  orderedRaw: string;
  deliveredDt: string;
  deliveredRaw: string;
  clientName: string;
  clientEmail: string;
}

interface DiscountVouchersReportRow {
  dvCode: string;
  dvAmount: number;
  expiryDate: string;
  productName: string;
  productType: string;
  item: string;
  orderedDate: string;
  orderedRaw: string;
  deliveredDt: string;
  deliveredRaw: string;
  clientName: string;
  clientEmail: string;
}

interface DeliveredOrdersRow {
  orderId: string;
  productName: string;
  productType: string;
  item: string;
  packagePurchased: string;
  mealVoucher: string | null;
  discountVoucher: string | null;
  orderedDate: string;
  orderedRaw: string;
  deliveredDt: string;
  deliveredRaw: string;
  leadTime: string;
  clientEmail: string;
}

export default function ReportingTab() {
  const supabase = createClient();

  const [productsOrderedRows, setProductsOrderedRows] = useState<ProductsOrderedRow[]>([]);
  const [productsOrderedLoading, setProductsOrderedLoading] = useState(false);
  const [packageMealsRows, setPackageMealsRows] = useState<PackageMealsOrderedRow[]>([]);
  const [packageMealsLoading, setPackageMealsLoading] = useState(false);
  const [frozenMealsRows, setFrozenMealsRows] = useState<PackageMealsOrderedRow[]>([]);
  const [frozenMealsLoading, setFrozenMealsLoading] = useState(false);
  const [discountVouchersReportRows, setDiscountVouchersReportRows] = useState<DiscountVouchersReportRow[]>([]);
  const [discountVouchersReportLoading, setDiscountVouchersReportLoading] = useState(false);
  const [deliveredOrdersRows, setDeliveredOrdersRows] = useState<DeliveredOrdersRow[]>([]);
  const [deliveredOrdersLoading, setDeliveredOrdersLoading] = useState(false);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const loadReporting = async () => {
    setProductsOrderedLoading(true);
    setPackageMealsLoading(true);
    setFrozenMealsLoading(true);
    setDiscountVouchersReportLoading(true);
    setDeliveredOrdersLoading(true);
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, customer_name, customer_email, items, created_at, delivered_date, m_payment_id, payment_status')
        .order('created_at', { ascending: false });

      const { data: dvData } = await supabase.from('discount_vouchers').select('dv_code, dv_amount, expiry_date, status, times_used, created_at');
      const dvMap: Record<string, { amount: number; expiry: string }> = {};
      (dvData || []).forEach((dv: any) => { dvMap[dv.dv_code] = { amount: dv.dv_amount, expiry: dv.expiry_date }; });

      const productsRows: ProductsOrderedRow[] = [];
      const packageRows: PackageMealsOrderedRow[] = [];
      const frozenRows: PackageMealsOrderedRow[] = [];
      const deliveredRows: DeliveredOrdersRow[] = [];
      const dvReportRows: DiscountVouchersReportRow[] = (dvData || []).map((dv: any) => ({
        dvCode: dv.dv_code,
        dvAmount: Number(dv.dv_amount),
        expiryDate: formatDate(dv.expiry_date),
        productName: '',
        productType: dv.status || '',
        item: `Used ${dv.times_used ?? 0} time(s)`,
        orderedDate: formatDate(dv.created_at),
        orderedRaw: dv.created_at,
        deliveredDt: '',
        deliveredRaw: '',
        clientName: dv.status || '',
        clientEmail: '',
      }));

      for (const order of (ordersData || [])) {
        const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
        const orderedDate = formatDate(order.created_at);
        const deliveredDt = formatDate(order.delivered_date);
        const mealVoucher = order.m_payment_id || null;
        const discountVoucher = null;

        for (const item of items) {
          const isPackage = item.category?.toLowerCase().includes('package') || item.category?.toLowerCase().includes('voucher') || (item.package_type && item.package_type !== 'none') || false;
          const isFrozen = item.category?.toLowerCase().includes('frozen') || false;
          if (isPackage) {
            const qty = Number(item.quantity) || 1;
            const isPackageType = item.package_type && item.package_type.toLowerCase().includes('package');
            for (let qi = 0; qi < qty; qi++) {
              packageRows.push({
                orderId: order.id,
                productName: item.name,
                productType: isPackageType ? (item.package_type || item.category || '') : (item.category || ''),
                item: item.name,
                packagePurchased: isPackageType ? (item.unit || item.category || '') : (item.category || ''),
                mealVoucher,
                discountVoucher,
                orderedDate,
                orderedRaw: order.created_at || '',
                deliveredDt,
                deliveredRaw: order.delivered_date || '',
                clientName: order.customer_name,
                clientEmail: order.customer_email,
              });
            }
          } else if (isFrozen) {
            const qty = Number(item.quantity) || 1;
            for (let qi = 0; qi < qty; qi++) {
              frozenRows.push({
                orderId: order.id,
                productName: item.name,
                productType: item.category || '',
                item: item.name,
                packagePurchased: item.category || '',
                mealVoucher,
                discountVoucher,
                orderedDate,
                orderedRaw: order.created_at || '',
                deliveredDt,
                deliveredRaw: order.delivered_date || '',
                clientName: order.customer_name,
                clientEmail: order.customer_email,
              });
            }
          } else {
            productsRows.push({
              orderId: order.id,
              productName: item.name,
              productType: item.category || '',
              item: `${item.quantity}x ${item.name}`,
              mealVoucher,
              discountVoucher,
              orderedDate,
              orderedRaw: order.created_at || '',
              deliveredDt,
              deliveredRaw: order.delivered_date || '',
              clientName: order.customer_name,
              clientEmail: order.customer_email,
            });
          }
        }

        if (order.delivered_date) {
          const orderedMs = order.created_at ? new Date(order.created_at).getTime() : null;
          const deliveredMs = new Date(order.delivered_date).getTime();
          let leadTime = '—';
          if (orderedMs !== null && !isNaN(deliveredMs) && !isNaN(orderedMs)) {
            const diffDays = Math.round((deliveredMs - orderedMs) / (1000 * 60 * 60 * 24));
            leadTime = diffDays === 0 ? 'Same day' : diffDays === 1 ? '1 day' : `${diffDays} days`;
          }
          const items2: OrderItem[] = Array.isArray(order.items) ? order.items : [];
          for (const item of items2) {
            const isPackageType = item.package_type && item.package_type.toLowerCase().includes('package');
            const qty = Number(item.quantity) || 1;
            for (let qi = 0; qi < qty; qi++) {
              deliveredRows.push({
                orderId: order.id,
                productName: item.name,
                productType: isPackageType ? (item.package_type || item.category || '') : (item.category || ''),
                item: item.name,
                packagePurchased: isPackageType ? (item.unit || item.category || '') : (item.category || ''),
                mealVoucher,
                discountVoucher,
                orderedDate,
                orderedRaw: order.created_at || '',
                deliveredDt,
                deliveredRaw: order.delivered_date || '',
                leadTime,
                clientEmail: order.customer_email,
              });
            }
          }
        }
      }

      setProductsOrderedRows(productsRows);
      setPackageMealsRows(packageRows);
      setFrozenMealsRows(frozenRows);
      setDiscountVouchersReportRows(dvReportRows);
      setDeliveredOrdersRows(deliveredRows);
    } catch (err) {
      console.error('Reporting load error:', err);
    } finally {
      setProductsOrderedLoading(false);
      setPackageMealsLoading(false);
      setFrozenMealsLoading(false);
      setDiscountVouchersReportLoading(false);
      setDeliveredOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadReporting();
  }, []);

  const isLoading = productsOrderedLoading || packageMealsLoading || frozenMealsLoading || discountVouchersReportLoading || deliveredOrdersLoading;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1A1612]">Reports Dashboard</h2>
          <p className="text-sm text-[#8C8278] mt-0.5">Summary of orders, revenue, and product activity</p>
        </div>
        <button
          onClick={loadReporting}
          disabled={isLoading}
          className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
              <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-[#1A1612]">
                {(() => {
                  const ids = new Set([
                    ...productsOrderedRows.map(r => r.orderId),
                    ...packageMealsRows.map(r => r.orderId),
                    ...frozenMealsRows.map(r => r.orderId),
                  ]);
                  return ids.size;
                })()}
              </p>
              <p className="text-xs text-[#8C8278] mt-1">across all categories</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
              <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-1">Delivered Orders</p>
              <p className="text-2xl font-bold text-[#1A1612]">
                {(() => {
                  const ids = new Set(deliveredOrdersRows.map(r => r.orderId));
                  return ids.size;
                })()}
              </p>
              <p className="text-xs text-[#8C8278] mt-1">fulfilled to date</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
              <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-1">Product Line Items</p>
              <p className="text-2xl font-bold text-[#1A1612]">{productsOrderedRows.length}</p>
              <p className="text-xs text-[#8C8278] mt-1">individual product rows</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
              <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-1">Discount Vouchers</p>
              <p className="text-2xl font-bold text-[#1A1612]">{discountVouchersReportRows.length}</p>
              <p className="text-xs text-[#8C8278] mt-1">vouchers on record</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-base font-bold text-[#1A1612] mb-3">Top Products Ordered</h3>
            {productsOrderedRows.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center">
                <p className="text-[#8C8278] text-sm">No product data available.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#FAF5EE] border-b border-[#EDE7DA]">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Product</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Category</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Times Ordered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDE7DA]">
                      {(() => {
                        const counts: Record<string, { category: string; count: number }> = {};
                        productsOrderedRows.forEach(r => {
                          if (!counts[r.productName]) counts[r.productName] = { category: r.productType, count: 0 };
                          counts[r.productName].count += 1;
                        });
                        return Object.entries(counts)
                          .sort((a, b) => b[1].count - a[1].count)
                          .slice(0, 10)
                          .map(([name, info]) => (
                            <tr key={name} className="hover:bg-[#FAF5EE] transition-colors">
                              <td className="px-4 py-3 font-medium text-[#1A1612]">{name}</td>
                              <td className="px-4 py-3 text-[#5C5347] text-xs">{info.category || '—'}</td>
                              <td className="px-4 py-3 text-right font-semibold text-[#C4622D]">{info.count}</td>
                            </tr>
                          ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-base font-bold text-[#1A1612] mb-3">Recent Activity</h3>
            {productsOrderedRows.length === 0 && packageMealsRows.length === 0 && frozenMealsRows.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center">
                <p className="text-[#8C8278] text-sm">No recent activity found.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#FAF5EE] border-b border-[#EDE7DA]">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Order ID</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Customer</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Item</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDE7DA]">
                      {[...productsOrderedRows, ...packageMealsRows, ...frozenMealsRows]
                        .sort((a, b) => (b.orderedRaw || '').localeCompare(a.orderedRaw || ''))
                        .slice(0, 15)
                        .map((r, idx) => (
                          <tr key={`${r.orderId}-${idx}`} className="hover:bg-[#FAF5EE] transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-[#C4622D]">{r.orderId.slice(0, 8)}…</td>
                            <td className="px-4 py-3 text-[#1A1612] font-medium">{r.clientName}</td>
                            <td className="px-4 py-3 text-[#5C5347]">{r.productName}</td>
                            <td className="px-4 py-3 text-xs text-[#8C8278]">{r.productType || '—'}</td>
                            <td className="px-4 py-3 text-xs text-[#8C8278]">{r.orderedDate}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
