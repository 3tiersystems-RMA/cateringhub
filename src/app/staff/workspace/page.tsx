'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { APP_NAME } from "@/lib/constants";

type BucketType = 'product-images' | 'event-photos';
type WorkspaceTab = 'products' | 'media' | 'orders' | 'staff' | 'homepage_cards' | 'categories';
type ProductCategory = string;
type StaffRole = 'admin' | 'staff' | 'super_admin';

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: { size?: number; mimetype?: string };
  signedUrl?: string;
}

interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  unit: string;
  image_path: string | null;
  description: string;
  tags: string[];
  badge: string | null;
  min_order: number | null;
  available: boolean;
  featured: boolean;
  sort_order: number;
  imageUrl?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

interface HomepageCard {
  id: string;
  card_type: 'todays_special' | 'next_booking' | 'customer_review';
  title: string;
  subtitle: string | null;
  description: string | null;
  price: number | null;
  price_unit: string | null;
  badge_label: string | null;
  event_date: string | null;
  guest_count: number | null;
  prep_percentage: number | null;
  reviewer_name: string | null;
  reviewer_event: string | null;
  rating: number | null;
  is_visible: boolean;
  display_order: number;
}

const CARD_TYPE_LABELS: Record<HomepageCard['card_type'], string> = {
  todays_special: "Today's Special",
  next_booking: 'Next Booking',
  customer_review: 'Customer Review',
};

const CARD_TYPE_ICONS: Record<HomepageCard['card_type'], string> = {
  todays_special: '🍽️',
  next_booking: '📅',
  customer_review: '⭐',
};

const emptyForm = {
  name: '',
  category: 'Catering Packages' as ProductCategory,
  price: '',
  unit: 'per serving',
  description: '',
  tags: '',
  badge: '',
  min_order: '',
  available: true,
  featured: false,
};

const emptyInviteForm = {
  full_name: '',
  email: '',
  role: 'staff' as StaffRole,
};

function RoleBadge({ role }: { role: StaffRole }) {
  const config: Record<StaffRole, { label: string; className: string }> = {
    super_admin: { label: 'Super Admin', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
    admin: { label: 'Admin', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
    staff: { label: 'Staff', className: 'bg-[#F5F0E8] text-[#5C5347] border border-[#DDD5C8]' },
  };
  const { label, className } = config[role] || config.staff;
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${className}`}>{label}</span>
  );
}

// ─── Inactivity Warning Modal ─────────────────────────────────────────────────
function InactivityWarningModal({
  countdown,
  onStayLoggedIn,
  onLogOut,
}: {
  countdown: number;
  onStayLoggedIn: () => void;
  onLogOut: () => void;
}) {
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeStr = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}s`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#DDD5C8] w-full max-w-md mx-4 p-8">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-[#1A1612] text-center mb-2">Session Expiring Soon</h2>
        <p className="text-[#5C5347] text-sm text-center mb-5">
          You have been inactive for 3 minutes. You will be automatically logged out in 2 minutes.
        </p>
        <div className="flex justify-center mb-6">
          <div className="bg-[#F5F0E8] border border-[#DDD5C8] rounded-xl px-6 py-3 text-center">
            <p className="text-xs text-[#8C8278] mb-1 font-medium uppercase tracking-wide">Logging out in</p>
            <p className="text-3xl font-bold text-[#C4622D] tabular-nums">{timeStr}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onStayLoggedIn}
            className="flex-1 bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-all duration-200"
          >
            Stay Logged In
          </button>
          <button
            onClick={onLogOut}
            className="flex-1 bg-white text-[#5C5347] border border-[#DDD5C8] py-3 rounded-xl font-semibold text-sm hover:bg-[#F5F0E8] transition-all duration-200"
          >
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffWorkspacePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productImageRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<StaffMember | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('products');

  // Media Library state
  const [activeBucket, setActiveBucket] = useState<BucketType>('product-images');
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string>('');
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('All');

  // Media Library Picker state (for product form)
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerFiles, setMediaPickerFiles] = useState<StorageFile[]>([]);
  const [mediaPickerLoading, setMediaPickerLoading] = useState(false);
  const [selectedMediaPath, setSelectedMediaPath] = useState<string>('');

  // Staff Management state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviting, setInviting] = useState(false);
  const [staffActionId, setStaffActionId] = useState<string | null>(null);
  const [staffActionMsg, setStaffActionMsg] = useState('');
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [resetPasswordMsg, setResetPasswordMsg] = useState('');

  // Homepage Cards state
  const [homepageCards, setHomepageCards] = useState<HomepageCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [editingCard, setEditingCard] = useState<HomepageCard | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardForm, setCardForm] = useState<Partial<HomepageCard>>({});
  const [cardFormError, setCardFormError] = useState('');
  const [cardFormSuccess, setCardFormSuccess] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [togglingCardId, setTogglingCardId] = useState<string | null>(null);

  // Categories state
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', sort_order: '' });
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categoryFormSuccess, setCategoryFormSuccess] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [togglingCategoryId, setTogglingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  // Dynamic categories from DB (for product form dropdowns)
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.replace('/staff/login');
        return;
      }
      setUser(currentUser);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      if (profile) setUserProfile(profile as StaffMember);

      await loadCategoryNames();
      await loadProducts();
    };
    init();
  }, []);

  const isSuperAdmin = userProfile?.role === 'super_admin';

  const profileLoaded = userProfile !== null || user === null;
  const { showWarning, countdown, stayLoggedIn, logOutNow } = useInactivityTimer({
    enabled: profileLoaded && !isSuperAdmin && !!user,
  });

  // ─── Load category names for dropdowns ───────────────────────────────────────
  const loadCategoryNames = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('name')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (data && data.length > 0) {
        const names = data.map((c: any) => c.name as string);
        setCategories(names);
        setForm((prev) => ({ ...prev, category: names[0] }));
      } else {
        // Fallback to RPC
        const { data: catData } = await supabase.rpc('get_product_categories');
        if (catData && Array.isArray(catData) && catData.length > 0) {
          setCategories(catData as string[]);
          setForm((prev) => ({ ...prev, category: catData[0] as string }));
        }
      }
    } catch (err) {
      console.log('Error loading categories:', err);
    }
  };

  // ─── Categories CRUD ──────────────────────────────────────────────────────────
  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) {
        console.log('Load categories error:', error.message);
        setCategoriesList([]);
        return;
      }
      setCategoriesList((data || []) as Category[]);
    } catch (err) {
      console.log('Unexpected error loading categories:', err);
      setCategoriesList([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const openAddCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', sort_order: String(categoriesList.length + 1) });
    setCategoryFormError('');
    setCategoryFormSuccess('');
    setShowCategoryForm(true);
  };

  const openEditCategoryForm = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, sort_order: String(cat.sort_order) });
    setCategoryFormError('');
    setCategoryFormSuccess('');
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryFormError('');
    setCategoryFormSuccess('');

    if (!categoryForm.name.trim()) {
      setCategoryFormError('Category name is required.');
      return;
    }

    setSavingCategory(true);
    try {
      const slug = categoryForm.name.trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      const payload = {
        name: categoryForm.name.trim(),
        slug,
        sort_order: categoryForm.sort_order ? Number(categoryForm.sort_order) : 0,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', editingCategory.id);
        if (error) {
          setCategoryFormError(`Update failed: ${error.message}`);
          return;
        }
        setCategoryFormSuccess('Category updated successfully!');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({ ...payload, active: true });
        if (error) {
          setCategoryFormError(`Create failed: ${error.message}`);
          return;
        }
        setCategoryFormSuccess('Category created successfully!');
      }

      await loadCategories();
      await loadCategoryNames();
      setTimeout(() => {
        setShowCategoryForm(false);
        setCategoryFormSuccess('');
      }, 1200);
    } catch (err) {
      setCategoryFormError('An unexpected error occurred.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleToggleCategoryActive = async (cat: Category) => {
    setTogglingCategoryId(cat.id);
    const { error } = await supabase
      .from('categories')
      .update({ active: !cat.active })
      .eq('id', cat.id);
    if (!error) {
      setCategoriesList((prev) =>
        prev.map((c) => c.id === cat.id ? { ...c, active: !c.active } : c)
      );
      await loadCategoryNames();
    }
    setTogglingCategoryId(null);
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}"? Products in this category will not be deleted but may need to be reassigned.`)) return;
    setDeletingCategoryId(cat.id);
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', cat.id);
      if (error) {
        console.log('Delete category error:', error.message);
        return;
      }
      setCategoriesList((prev) => prev.filter((c) => c.id !== cat.id));
      await loadCategoryNames();
    } catch (err) {
      console.log('Unexpected delete category error:', err);
    } finally {
      setDeletingCategoryId(null);
    }
  };

  // ─── Staff Management ────────────────────────────────────────────────────────

  const loadStaffMembers = async () => {
    setStaffLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.log('Load staff error:', error.message);
        setStaffMembers([]);
        return;
      }
      setStaffMembers((data || []) as StaffMember[]);
    } catch (err) {
      console.log('Unexpected error loading staff:', err);
      setStaffMembers([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');

    if (!inviteForm.full_name.trim()) { setInviteError('Full name is required.'); return; }
    if (!inviteForm.email.trim()) { setInviteError('Email is required.'); return; }

    setInviting(true);
    try {
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          full_name: inviteForm.full_name.trim(),
          role: inviteForm.role,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setInviteError(result.error || 'Failed to send invitation.');
        return;
      }

      setInviteSuccess(`Invitation sent to ${inviteForm.email}!`);
      setInviteForm(emptyInviteForm);
      await loadStaffMembers();
      setTimeout(() => {
        setShowInviteForm(false);
        setInviteSuccess('');
      }, 2000);
    } catch (err) {
      setInviteError('An unexpected error occurred.');
    } finally {
      setInviting(false);
    }
  };

  const handleSuspendStaff = async (member: StaffMember) => {
    if (member.id === user?.id) return;
    setStaffActionId(member.id);
    setStaffActionMsg('');
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', member.id);
      if (error) {
        setStaffActionMsg('Failed to suspend account.');
        return;
      }
      setStaffMembers((prev) =>
        prev.map((m) => m.id === member.id ? { ...m, is_active: false } : m)
      );
    } catch (err) {
      setStaffActionMsg('An unexpected error occurred.');
    } finally {
      setStaffActionId(null);
    }
  };

  const handleReinstateStaff = async (member: StaffMember) => {
    setStaffActionId(member.id);
    setStaffActionMsg('');
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: true })
        .eq('id', member.id);
      if (error) {
        setStaffActionMsg('Failed to reinstate account.');
        return;
      }
      setStaffMembers((prev) =>
        prev.map((m) => m.id === member.id ? { ...m, is_active: true } : m)
      );
    } catch (err) {
      setStaffActionMsg('An unexpected error occurred.');
    } finally {
      setStaffActionId(null);
    }
  };

  const handleResetPassword = async (member: StaffMember) => {
    if (member.id === user?.id) return;
    setResetPasswordId(member.id);
    setResetPasswordMsg('');
    setStaffActionMsg('');
    try {
      const response = await fetch('/api/staff/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, email: member.email }),
      });
      const result = await response.json();
      if (!response.ok) {
        setStaffActionMsg(result.error || 'Failed to send password reset email.');
        return;
      }
      setResetPasswordMsg(`Password reset email sent to ${member.email}`);
      setTimeout(() => setResetPasswordMsg(''), 5000);
    } catch (err) {
      setStaffActionMsg('An unexpected error occurred.');
    } finally {
      setResetPasswordId(null);
    }
  };

  // ─── Products ───────────────────────────────────────────────────────────────

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.log('Load products error:', error.message);
        setProducts([]);
        return;
      }

      const withUrls = await Promise.all(
        (data || []).map(async (p) => {
          let imageUrl = '';
          if (p.image_path) {
            const { data: urlData } = supabase.storage
              .from('product-images')
              .getPublicUrl(p.image_path);
            imageUrl = urlData?.publicUrl || '';
          }
          return { ...p, imageUrl };
        })
      );
      setProducts(withUrls);
    } catch (err) {
      console.log('Unexpected error loading products:', err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setProductImageFile(null);
    setProductImagePreview('');
    setSelectedMediaPath('');
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      unit: product.unit,
      description: product.description,
      tags: product.tags?.join(', ') || '',
      badge: product.badge || '',
      min_order: product.min_order ? String(product.min_order) : '',
      available: product.available,
      featured: product.featured,
    });
    setProductImageFile(null);
    setProductImagePreview(product.imageUrl || '');
    setSelectedMediaPath('');
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const handleProductImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select an image file.');
      return;
    }
    setProductImageFile(file);
    setProductImagePreview(URL.createObjectURL(file));
    setSelectedMediaPath('');
    setFormError('');
  };

  const openMediaPicker = async () => {
    setShowMediaPicker(true);
    setMediaPickerLoading(true);
    try {
      const { data, error } = await supabase.storage.from('product-images').list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) { setMediaPickerFiles([]); return; }
      const filesWithUrls = await Promise.all(
        (data || []).filter((f) => f.name !== '.emptyFolderPlaceholder').map(async (file) => {
          const { data: signedData } = await supabase.storage
            .from('product-images')
            .createSignedUrl(file.name, 3600);
          return { ...file, signedUrl: signedData?.signedUrl || '' } as StorageFile;
        })
      );
      setMediaPickerFiles(filesWithUrls);
    } catch (err) {
      setMediaPickerFiles([]);
    } finally {
      setMediaPickerLoading(false);
    }
  };

  const handleSelectMediaImage = (file: StorageFile) => {
    setProductImagePreview(file.signedUrl);
    setSelectedMediaPath(file.name);
    setProductImageFile(null);
    setShowMediaPicker(false);
    setFormError('');
  };

  const uploadProductImage = async (file: File): Promise<string | null> => {
    setUploadingProductImage(true);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    setUploadingProductImage(false);
    if (error) {
      console.log('Image upload error:', error.message);
      return null;
    }
    return fileName;
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!form.name.trim()) { setFormError('Product name is required.'); return; }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) {
      setFormError('Please enter a valid price.'); return;
    }
    if (!form.description.trim()) { setFormError('Description is required.'); return; }

    setSaving(true);
    try {
      let imagePath = editingProduct?.image_path || null;

      if (selectedMediaPath) {
        imagePath = selectedMediaPath;
      } else if (productImageFile) {
        const uploaded = await uploadProductImage(productImageFile);
        if (uploaded) {
          if (editingProduct?.image_path) {
            await supabase.storage.from('product-images').remove([editingProduct.image_path]);
          }
          imagePath = uploaded;
        } else {
          setFormError('Image upload failed. Please try again.');
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        unit: form.unit.trim() || 'per serving',
        description: form.description.trim(),
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        badge: form.badge.trim() || null,
        min_order: form.min_order ? Number(form.min_order) : null,
        available: form.available,
        featured: form.featured,
        image_path: imagePath,
      };

      if (editingProduct) {
        const { error, data: updateData } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id)
          .select();
        if (error) {
          console.error('Update error:', JSON.stringify(error));
          setFormError(`Update failed: ${error.message}`);
          setSaving(false);
          return;
        }
        if (!updateData || updateData.length === 0) {
          setFormError('Update was blocked — you may not have permission to edit this product. Please ensure your account has staff access.');
          setSaving(false);
          return;
        }
        setFormSuccess('Product updated successfully!');
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) {
          console.error('Insert error:', JSON.stringify(error));
          setFormError(error.message);
          setSaving(false);
          return;
        }
        setFormSuccess('Product created successfully!');
      }

      await loadProducts();
      setTimeout(() => {
        setShowForm(false);
        setFormSuccess('');
      }, 1200);
    } catch (err) {
      console.log('Save product error:', err);
      setFormError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeletingProductId(product.id);
    try {
      if (product.image_path) {
        await supabase.storage.from('product-images').remove([product.image_path]);
      }
      const { error } = await supabase.from('products').delete().eq('id', product.id);
      if (error) { console.log('Delete error:', error.message); return; }
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (err) {
      console.log('Unexpected delete error:', err);
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleToggleAvailable = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ available: !product.available })
      .eq('id', product.id);
    if (!error) {
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, available: !p.available } : p)
      );
    }
  };

  // ─── Media Library ───────────────────────────────────────────────────────────

  const loadFiles = async (bucket: BucketType) => {
    setMediaLoading(true);
    try {
      const { data, error } = await supabase.storage.from(bucket).list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) { setFiles([]); return; }
      const filesWithUrls = await Promise.all(
        (data || []).filter((f) => f.name !== '.emptyFolderPlaceholder').map(async (file) => {
          const { data: signedData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(file.name, 3600);
          return { ...file, signedUrl: signedData?.signedUrl || '' } as StorageFile;
        })
      );
      setFiles(filesWithUrls);
    } catch (err) {
      setFiles([]);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleBucketChange = async (bucket: BucketType) => {
    setActiveBucket(bucket);
    setUploadError('');
    setUploadSuccess('');
    await loadFiles(bucket);
  };

  const handleUpload = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    let successCount = 0;
    let errorCount = 0;
    for (const file of Array.from(selectedFiles)) {
      if (!file.type.startsWith('image/')) { errorCount++; continue; }
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from(activeBucket).upload(fileName, file, {
        cacheControl: '3600', upsert: false,
      });
      if (error) { errorCount++; } else { successCount++; }
    }
    if (successCount > 0) {
      setUploadSuccess(`${successCount} image${successCount > 1 ? 's' : ''} uploaded successfully!`);
      await loadFiles(activeBucket);
    }
    if (errorCount > 0) {
      setUploadError(`${errorCount} file${errorCount > 1 ? 's' : ''} failed. Only image files are accepted.`);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = async (fileName: string) => {
    setDeletingId(fileName);
    try {
      const { error } = await supabase.storage.from(activeBucket).remove([fileName]);
      if (!error) setFiles((prev) => prev.filter((f) => f.name !== fileName));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/staff/login');
    router.refresh();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredProducts = filterCategory === 'All'
    ? products
    : products.filter((p) => p.category === filterCategory);

  const buckets: { id: BucketType; label: string; description: string; icon: string }[] = [
    { id: 'product-images', label: 'Product Images', description: 'Menu items, dishes & catering products', icon: '🍽️' },
    { id: 'event-photos', label: 'Event Photos', description: 'Marketing photos from events', icon: '📸' },
  ];

  // ─── Homepage Cards ──────────────────────────────────────────────────────────

  const loadHomepageCards = async () => {
    setCardsLoading(true);
    try {
      const { data, error } = await supabase
        .from('homepage_cards')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) {
        console.log('Load homepage cards error:', error.message);
        setHomepageCards([]);
        return;
      }
      setHomepageCards((data || []) as HomepageCard[]);
    } catch (err) {
      console.log('Unexpected error loading homepage cards:', err);
      setHomepageCards([]);
    } finally {
      setCardsLoading(false);
    }
  };

  const openCardEditForm = (card: HomepageCard) => {
    setEditingCard(card);
    setCardForm({
      title: card.title,
      description: card.description,
      price: card.price,
      price_unit: card.price_unit,
      badge_label: card.badge_label,
      event_date: card.event_date,
      guest_count: card.guest_count,
      prep_percentage: card.prep_percentage,
      reviewer_name: card.reviewer_name,
      reviewer_event: card.reviewer_event,
      rating: card.rating,
      is_visible: card.is_visible,
    });
    setCardFormError('');
    setCardFormSuccess('');
    setShowCardForm(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    setCardFormError('');
    setCardFormSuccess('');

    if (!cardForm.title?.trim()) {
      setCardFormError('Title is required.');
      return;
    }

    setSavingCard(true);
    try {
      const payload: Partial<HomepageCard> = {
        title: cardForm.title?.trim() || '',
        description: cardForm.description?.trim() || null,
        price: cardForm.price !== undefined ? Number(cardForm.price) || null : null,
        price_unit: cardForm.price_unit?.trim() || null,
        badge_label: cardForm.badge_label?.trim() || null,
        event_date: cardForm.event_date?.trim() || null,
        guest_count: cardForm.guest_count !== undefined ? Number(cardForm.guest_count) || null : null,
        prep_percentage: cardForm.prep_percentage !== undefined ? Number(cardForm.prep_percentage) || null : null,
        reviewer_name: cardForm.reviewer_name?.trim() || null,
        reviewer_event: cardForm.reviewer_event?.trim() || null,
        rating: cardForm.rating !== undefined ? Number(cardForm.rating) || null : null,
        is_visible: cardForm.is_visible ?? true,
      };

      const { error } = await supabase
        .from('homepage_cards')
        .update(payload)
        .eq('id', editingCard.id);

      if (error) {
        setCardFormError(`Save failed: ${error.message}`);
        return;
      }

      setCardFormSuccess('Card updated successfully!');
      await loadHomepageCards();
      setTimeout(() => {
        setShowCardForm(false);
        setCardFormSuccess('');
      }, 1200);
    } catch (err) {
      setCardFormError('An unexpected error occurred.');
    } finally {
      setSavingCard(false);
    }
  };

  const handleToggleCardVisibility = async (card: HomepageCard) => {
    setTogglingCardId(card.id);
    const { error } = await supabase
      .from('homepage_cards')
      .update({ is_visible: !card.is_visible })
      .eq('id', card.id);
    if (!error) {
      setHomepageCards((prev) =>
        prev.map((c) => c.id === card.id ? { ...c, is_visible: !c.is_visible } : c)
      );
    }
    setTogglingCardId(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {showWarning && (
        <InactivityWarningModal
          countdown={countdown}
          onStayLoggedIn={stayLoggedIn}
          onLogOut={logOutNow}
        />
      )}

      {/* Header */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={40} iconName="FireIcon" text={APP_NAME} />
            <div className="hidden sm:block h-5 w-px bg-gray-600" />
            <span className="hidden sm:block text-sm font-medium text-gray-300">Staff Workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-gray-300">{user?.email}</span>
              {userProfile && <RoleBadge role={userProfile.role} />}
            </div>
            <a
              href="/staff/orders"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800 flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
              Orders
            </a>
            <button
              onClick={handleSignOut}
              className="text-sm font-medium text-[#C4622D] hover:text-[#E07040] transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Page Title + Tabs */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1A1612] mb-1">Staff Workspace</h1>
          <p className="text-[#8C8278] text-sm mb-6 text-center max-w-sm">
            Manage your products, prices, and media library
          </p>
          <div className="flex gap-2 border-b border-[#DDD5C8] flex-wrap">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === 'products' ? 'border-[#C4622D] text-[#C4622D]' : 'border-transparent text-[#8C8278] hover:text-[#5C5347]'
              }`}
            >
              🍽️ Products & Pricing
            </button>
            <button
              onClick={() => { setActiveTab('categories'); if (categoriesList.length === 0) loadCategories(); }}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === 'categories' ? 'border-[#C4622D] text-[#C4622D]' : 'border-transparent text-[#8C8278] hover:text-[#5C5347]'
              }`}
            >
              🏷️ Categories
            </button>
            <button
              onClick={() => { setActiveTab('media'); if (files.length === 0) loadFiles(activeBucket); }}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === 'media' ? 'border-[#C4622D] text-[#C4622D]' : 'border-transparent text-[#8C8278] hover:text-[#5C5347]'
              }`}
            >
              📸 Media Library
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === 'orders' ? 'border-[#C4622D] text-[#C4622D]' : 'border-transparent text-[#8C8278] hover:text-[#5C5347]'
              }`}
            >
              📋 Orders
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => { setActiveTab('staff'); if (staffMembers.length === 0) loadStaffMembers(); }}
                className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                  activeTab === 'staff' ? 'border-purple-600 text-purple-600' : 'border-transparent text-[#8C8278] hover:text-[#5C5347]'
                }`}
              >
                👥 Staff Management
              </button>
            )}
            <button
              onClick={() => { setActiveTab('homepage_cards'); if (homepageCards.length === 0) loadHomepageCards(); }}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === 'homepage_cards' ? 'border-[#C4622D] text-[#C4622D]' : 'border-transparent text-[#8C8278] hover:text-[#5C5347]'
              }`}
            >
              🏠 Homepage Cards
            </button>
          </div>
        </div>

        {/* ── PRODUCTS TAB ── */}
        {activeTab === 'products' && (
          <div>
            {/* Product Form Modal */}
            {showForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">
                      {editingProduct ? 'Edit Product' : 'Add New Product'}
                    </h2>
                    <button
                      onClick={() => setShowForm(false)}
                      className="w-8 h-8 rounded-full bg-[#F5F0E8] flex items-center justify-center text-[#8C8278] hover:bg-[#EDE7DA] transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveProduct} className="p-6 space-y-5">
                    {/* Image Upload */}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-2">Product Image</label>
                      <div className="flex items-start gap-4">
                        <div
                          className="w-24 h-24 rounded-xl border-2 border-dashed border-[#DDD5C8] bg-[#F5F0E8] flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-[#C4622D] transition-colors"
                          onClick={openMediaPicker}
                        >
                          {productImagePreview ? (
                            <img src={productImagePreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl">🍽️</span>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                          <input
                            ref={productImageRef}
                            type="file"
                            accept="image/*"
                            onChange={handleProductImageSelect}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={openMediaPicker}
                            className="text-sm font-medium text-white bg-[#C4622D] px-4 py-2 rounded-lg hover:bg-[#A04E22] transition-colors flex items-center gap-2"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-4-4m0 0L8 8m4-4v6" />
                            </svg>
                            {productImagePreview ? 'Change from Media Library' : 'Choose from Media Library'}
                          </button>
                          <button
                            type="button"
                            onClick={() => productImageRef.current?.click()}
                            className="text-sm font-medium text-[#C4622D] border border-[#C4622D] px-4 py-2 rounded-lg hover:bg-[#FDF6F0] transition-colors"
                          >
                            Upload from Device
                          </button>
                          <p className="text-xs text-[#B0A89E]">JPG, PNG, WebP · Max 10MB</p>
                          {uploadingProductImage && (
                            <p className="text-xs text-[#C4622D]">Uploading image...</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Product Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Classic BBQ Package"
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        required
                      />
                    </div>

                    {/* Category + Price */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Category *</label>
                        <select
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value })}
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors bg-white"
                        >
                          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Price (R) *</label>
                        <input
                          type="number"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                          required
                        />
                      </div>
                    </div>

                    {/* Unit + Min Order */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Unit</label>
                        <input
                          type="text"
                          value={form.unit}
                          onChange={(e) => setForm({ ...form, unit: e.target.value })}
                          placeholder="per serving"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Min. Order</label>
                        <input
                          type="number"
                          value={form.min_order}
                          onChange={(e) => setForm({ ...form, min_order: e.target.value })}
                          placeholder="Optional"
                          min="1"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Description *</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Describe the product..."
                        rows={3}
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors resize-none"
                        required
                      />
                    </div>

                    {/* Tags + Badge */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Tags</label>
                        <input
                          type="text"
                          value={form.tags}
                          onChange={(e) => setForm({ ...form, tags: e.target.value })}
                          placeholder="Vegan, Gluten-Free, ..."
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                        <p className="text-xs text-[#B0A89E] mt-1">Comma-separated</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Badge Label</label>
                        <input
                          type="text"
                          value={form.badge}
                          onChange={(e) => setForm({ ...form, badge: e.target.value })}
                          placeholder="e.g. Best Seller, New, Popular"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div
                          onClick={() => setForm({ ...form, available: !form.available })}
                          className={`w-10 h-6 rounded-full transition-colors relative ${
                            form.available ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'
                          }`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            form.available ? 'translate-x-5' : 'translate-x-1'
                          }`} />
                        </div>
                        <span className="text-sm font-medium text-[#3D3530]">Available</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div
                          onClick={() => setForm({ ...form, featured: !form.featured })}
                          className={`w-10 h-6 rounded-full transition-colors relative ${
                            form.featured ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'
                          }`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            form.featured ? 'translate-x-5' : 'translate-x-1'
                          }`} />
                        </div>
                        <span className="text-sm font-medium text-[#3D3530]">Featured on Homepage</span>
                      </label>
                    </div>

                    {formError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{formError}</div>
                    )}
                    {formSuccess && (
                      <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">{formSuccess}</div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="flex-1 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-[#C4622D] text-white text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
                        ) : editingProduct ? 'Save Changes' : 'Add Product'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Media Library Picker Modal */}
            {showMediaPicker && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <div>
                      <h3 className="text-base font-bold text-[#1A1612]">Media Library</h3>
                      <p className="text-xs text-[#8C8278] mt-0.5">Select an image from your product images</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMediaPicker(false)}
                      className="w-8 h-8 rounded-full bg-[#F5F0E8] flex items-center justify-center text-[#8C8278] hover:bg-[#EDE7DA] transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    {mediaPickerLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : mediaPickerFiles.length === 0 ? (
                      <div className="text-center py-16">
                        <span className="text-4xl mb-3 block">🖼️</span>
                        <p className="text-[#5C5347] font-semibold mb-1">No images in Media Library</p>
                        <p className="text-[#B0A89E] text-sm">Upload images via the Media Library tab first, then return here to select one.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {mediaPickerFiles.map((file) => (
                          <button
                            key={file.name}
                            type="button"
                            onClick={() => handleSelectMediaImage(file)}
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                              selectedMediaPath === file.name
                                ? 'border-[#C4622D] ring-2 ring-[#C4622D]/30'
                                : 'border-[#DDD5C8] hover:border-[#C4622D]'
                            }`}
                          >
                            <img src={file.signedUrl} alt={file.name} className="w-full h-full object-cover" />
                            {selectedMediaPath === file.name && (
                              <div className="absolute inset-0 bg-[#C4622D]/20 flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-[#C4622D] flex items-center justify-center">
                                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {mediaPickerFiles.length > 0 && (
                    <div className="px-6 py-4 border-t border-[#EDE7DA] flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowMediaPicker(false)}
                        className="px-4 py-2 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Products Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex gap-2 flex-wrap">
                {['All', ...categories].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      filterCategory === cat
                        ? 'bg-[#C4622D] text-white'
                        : 'bg-white border border-[#DDD5C8] text-[#5C5347] hover:border-[#C4622D]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                onClick={openCreateForm}
                className="flex items-center gap-2 bg-[#C4622D] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Product
              </button>
            </div>

            {/* Products Grid */}
            {productsLoading ? (
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-[#DDD5C8]">
                <div className="text-5xl mb-3">🍽️</div>
                <p className="text-[#5C5347] font-semibold">No products yet</p>
                <p className="text-[#B0A89E] text-sm mt-1 mb-4">Add your first product to get started</p>
                <button
                  onClick={openCreateForm}
                  className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
                >
                  Add Product
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-[#DDD5C8] overflow-hidden hover:border-[#C4622D]/40 hover:shadow-md transition-all duration-200"
                  >
                    <div className="relative h-40 bg-[#F5F0E8] overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
                      )}
                      <button
                        onClick={() => handleToggleAvailable(product)}
                        className={`absolute top-2 right-2 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          product.available ? 'bg-green-500 text-white' : 'bg-[#8C8278] text-white'
                        }`}
                      >
                        {product.available ? 'Available' : 'Hidden'}
                      </button>
                      {product.badge && (
                        <span className="absolute top-2 left-2 text-xs font-semibold bg-[#C4622D] text-white px-2.5 py-0.5 rounded-full">
                          {product.badge}
                        </span>
                      )}
                      {product.featured && (
                        <span className="absolute bottom-2 left-2 text-xs font-semibold bg-[#D4A853] text-white px-2.5 py-0.5 rounded-full">
                          ⭐ Featured
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-mono text-[#C4622D] uppercase tracking-wider mb-1">{product.category}</p>
                      <h3 className="font-semibold text-[#1A1612] text-sm leading-snug mb-1 line-clamp-1">{product.name}</h3>
                      <p className="text-xs text-[#8C8278] line-clamp-2 mb-3">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-[#1A1612]">R{product.price}</p>
                          <p className="text-xs text-[#B0A89E]">{product.unit}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditForm(product)}
                            className="w-8 h-8 rounded-lg bg-[#F5F0E8] flex items-center justify-center text-[#5C5347] hover:bg-[#EDE7DA] transition-colors"
                            title="Edit"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product)}
                            disabled={deletingProductId === product.id}
                            className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            {deletingProductId === product.id ? (
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            ) : (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CATEGORIES TAB ── */}
        {activeTab === 'categories' && (
          <div>
            {/* Category Form Modal */}
            {showCategoryForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">
                      {editingCategory ? 'Edit Category' : 'Add New Category'}
                    </h2>
                    <button
                      onClick={() => setShowCategoryForm(false)}
                      className="w-8 h-8 rounded-full bg-[#F5F0E8] flex items-center justify-center text-[#8C8278] hover:bg-[#EDE7DA] transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Category Name *</label>
                      <input
                        type="text"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        placeholder="e.g. Seasonal Specials"
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Sort Order</label>
                      <input
                        type="number"
                        value={categoryForm.sort_order}
                        onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })}
                        placeholder="0"
                        min="0"
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                      />
                      <p className="text-xs text-[#B0A89E] mt-1">Lower numbers appear first</p>
                    </div>
                    {categoryFormError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{categoryFormError}</div>
                    )}
                    {categoryFormSuccess && (
                      <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">{categoryFormSuccess}</div>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCategoryForm(false)}
                        className="flex-1 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingCategory}
                        className="flex-1 py-2.5 rounded-xl bg-[#C4622D] text-white text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {savingCategory ? (
                          <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
                        ) : editingCategory ? 'Save Changes' : 'Add Category'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Categories Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Food Categories</h2>
                <p className="text-sm text-[#8C8278] mt-0.5">Active categories appear on the Menu &amp; Order page and all other places categories are displayed</p>
              </div>
              <button
                onClick={openAddCategoryForm}
                className="flex items-center gap-2 bg-[#C4622D] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Category
              </button>
            </div>

            {/* Categories Table */}
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : categoriesList.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-[#DDD5C8]">
                <div className="text-5xl mb-3">🏷️</div>
                <p className="text-[#5C5347] font-semibold">No categories yet</p>
                <p className="text-[#B0A89E] text-sm mt-1 mb-4">Add your first category to get started</p>
                <button
                  onClick={openAddCategoryForm}
                  className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
                >
                  Add Category
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#DDD5C8] overflow-hidden">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-[#F5F0E8] border-b border-[#DDD5C8] text-xs font-semibold text-[#8C8278] uppercase tracking-wider">
                  <div className="col-span-5">Name</div>
                  <div className="col-span-2 text-center">Sort Order</div>
                  <div className="col-span-2 text-center">Status</div>
                  <div className="col-span-3 text-right">Actions</div>
                </div>

                {categoriesList.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className={`px-6 py-4 flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 md:gap-4 ${
                      idx < categoriesList.length - 1 ? 'border-b border-[#EDE7DA]' : ''
                    }`}
                  >
                    {/* Name */}
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#F5F0E8] flex items-center justify-center text-base flex-shrink-0">
                        🏷️
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1A1612]">{cat.name}</p>
                        <p className="text-xs text-[#B0A89E]">{cat.slug}</p>
                      </div>
                    </div>

                    {/* Sort Order */}
                    <div className="col-span-2 text-center">
                      <span className="text-sm text-[#5C5347] font-mono">{cat.sort_order}</span>
                    </div>

                    {/* Status Toggle */}
                    <div className="col-span-2 flex justify-center">
                      <button
                        onClick={() => handleToggleCategoryActive(cat)}
                        disabled={togglingCategoryId === cat.id}
                        className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                          cat.active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' :'bg-[#F5F0E8] text-[#8C8278] hover:bg-[#EDE7DA]'
                        }`}
                        title={cat.active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {togglingCategoryId === cat.id ? (
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${cat.active ? 'bg-green-500' : 'bg-[#B5ADA5]'}`} />
                        )}
                        {cat.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditCategoryForm(cat)}
                        className="w-8 h-8 rounded-lg bg-[#F5F0E8] flex items-center justify-center text-[#5C5347] hover:bg-[#EDE7DA] transition-colors"
                        title="Edit category"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        disabled={deletingCategoryId === cat.id}
                        className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
                        title="Delete category"
                      >
                        {deletingCategoryId === cat.id ? (
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info box */}
            <div className="mt-6 bg-[#F5F0E8] border border-[#DDD5C8] rounded-xl p-4">
              <p className="text-sm font-semibold text-[#3D3530] mb-1">ℹ️ About Categories</p>
              <p className="text-xs text-[#5C5347] leading-relaxed">
                Only <strong>Active</strong> categories are shown on the Menu &amp; Order page and all other places where food categories are displayed.
                Set a category to <strong>Inactive</strong> to hide it from customers — useful for seasonal menus.
                Products in inactive categories remain in the database but will not be visible to customers.
              </p>
            </div>
          </div>
        )}

        {/* ── MEDIA LIBRARY TAB ── */}
        {activeTab === 'media' && (
          <div>
            <div className="flex gap-3 mb-6 flex-wrap">
              {buckets.map((bucket) => (
                <button
                  key={bucket.id}
                  onClick={() => handleBucketChange(bucket.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                    activeBucket === bucket.id
                      ? 'bg-[#C4622D] text-white shadow-md'
                      : 'bg-white text-[#5C5347] border border-[#DDD5C8] hover:border-[#C4622D] hover:text-[#C4622D]'
                  }`}
                >
                  <span>{bucket.icon}</span>
                  <div className="text-left">
                    <div>{bucket.label}</div>
                    <div className={`text-xs font-normal ${
                      activeBucket === bucket.id ? 'text-orange-100' : 'text-[#B0A89E]'
                    }`}>{bucket.description}</div>
                  </div>
                </button>
              ))}
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
              className={`bg-white rounded-2xl border-2 border-dashed p-8 mb-6 text-center transition-all duration-200 ${
                dragOver ? 'border-[#C4622D] bg-orange-50' : 'border-[#DDD5C8] hover:border-[#C4622D]'
              }`}
            >
              <div className="text-4xl mb-3">{activeBucket === 'product-images' ? '🍽️' : '📸'}</div>
              <p className="text-[#3D3530] font-semibold mb-1">Drop images here or click to upload</p>
              <p className="text-[#B0A89E] text-sm mb-4">Supports JPG, PNG, WebP, GIF · Max 10MB per file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleUpload(e.target.files)}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`inline-flex items-center gap-2 bg-[#C4622D] text-white px-6 py-2.5 rounded-full text-sm font-semibold cursor-pointer hover:bg-[#A04E22] transition-all duration-200 ${
                  uploading ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {uploading ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Uploading...</>
                ) : (
                  <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-6l-4-4m0 0L8 8m4-4v6" /></svg>Upload Images</>
                )}
              </label>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{uploadError}</div>
            )}
            {uploadSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">{uploadSuccess}</div>
            )}

            {mediaLoading ? (
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-[#DDD5C8]">
                <div className="text-4xl mb-3">{activeBucket === 'product-images' ? '🍽️' : '📸'}</div>
                <p className="text-[#5C5347] font-semibold">No images yet</p>
                <p className="text-[#B0A89E] text-sm mt-1">Upload your first image above</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file) => (
                  <div key={file.name} className="group relative bg-white rounded-xl border border-[#DDD5C8] overflow-hidden hover:border-[#C4622D]/40 hover:shadow-md transition-all">
                    <div className="aspect-square bg-[#F5F0E8] overflow-hidden">
                      {file.signedUrl ? (
                        <img src={file.signedUrl} alt={file.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🖼️</div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-[#5C5347] font-medium truncate">{file.name}</p>
                      <p className="text-xs text-[#B0A89E]">{formatFileSize(file.metadata?.size)}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(file.name)}
                      disabled={deletingId === file.name}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                    >
                      {deletingId === file.name ? (
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HOMEPAGE CARDS TAB ── */}
        {activeTab === 'homepage_cards' && (
          <div>
            {showCardForm && editingCard && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{CARD_TYPE_ICONS[editingCard.card_type]}</span>
                      <h2 className="font-bold text-[#1A1612] text-lg">
                        Edit {CARD_TYPE_LABELS[editingCard.card_type]}
                      </h2>
                    </div>
                    <button
                      onClick={() => setShowCardForm(false)}
                      className="w-8 h-8 rounded-full bg-[#F5F0E8] flex items-center justify-center text-[#8C8278] hover:bg-[#EDE7DA] transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveCard} className="p-6 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-[#F5F0E8] rounded-xl">
                      <div
                        onClick={() => setCardForm({ ...cardForm, is_visible: !cardForm.is_visible })}
                        className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                          cardForm.is_visible ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          cardForm.is_visible ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#3D3530]">Visible on Homepage</p>
                        <p className="text-xs text-[#8C8278]">{cardForm.is_visible ? 'This card is showing on the live site' : 'This card is hidden from the live site'}</p>
                      </div>
                    </label>

                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">
                        {editingCard.card_type === 'next_booking' ? 'Event Name *' : 'Title *'}
                      </label>
                      <input
                        type="text"
                        value={cardForm.title || ''}
                        onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                        placeholder={editingCard.card_type === 'next_booking' ? 'e.g. Corporate Lunch' : 'e.g. Pan-Seared Salmon'}
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        required
                      />
                    </div>

                    {editingCard.card_type === 'todays_special' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Price</label>
                            <input
                              type="number"
                              value={cardForm.price ?? ''}
                              onChange={(e) => setCardForm({ ...cardForm, price: e.target.value ? Number(e.target.value) : null })}
                              placeholder="28"
                              min="0"
                              step="0.01"
                              className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Price Unit</label>
                            <input
                              type="text"
                              value={cardForm.price_unit || ''}
                              onChange={(e) => setCardForm({ ...cardForm, price_unit: e.target.value })}
                              placeholder="serving"
                              className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Badge Label</label>
                          <input
                            type="text"
                            value={cardForm.badge_label || ''}
                            onChange={(e) => setCardForm({ ...cardForm, badge_label: e.target.value })}
                            placeholder="e.g. Limited, New, Popular"
                            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                          />
                        </div>
                      </>
                    )}

                    {editingCard.card_type === 'next_booking' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Event Date</label>
                            <input
                              type="text"
                              value={cardForm.event_date || ''}
                              onChange={(e) => setCardForm({ ...cardForm, event_date: e.target.value })}
                              placeholder="e.g. Feb 24"
                              className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Guest Count</label>
                            <input
                              type="number"
                              value={cardForm.guest_count ?? ''}
                              onChange={(e) => setCardForm({ ...cardForm, guest_count: e.target.value ? Number(e.target.value) : null })}
                              placeholder="80"
                              min="1"
                              className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Prep Completion (%)</label>
                          <input
                            type="number"
                            value={cardForm.prep_percentage ?? ''}
                            onChange={(e) => setCardForm({ ...cardForm, prep_percentage: e.target.value ? Number(e.target.value) : null })}
                            placeholder="75"
                            min="0"
                            max="100"
                            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                          />
                          {cardForm.prep_percentage !== null && cardForm.prep_percentage !== undefined && (
                            <div className="mt-2 h-1.5 bg-[#EDE7DA] rounded-full">
                              <div
                                className="h-1.5 bg-[#C4622D] rounded-full transition-all"
                                style={{ width: `${Math.min(100, Math.max(0, Number(cardForm.prep_percentage)))}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {editingCard.card_type === 'customer_review' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Reviewer Quote</label>
                          <textarea
                            value={cardForm.description || ''}
                            onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })}
                            placeholder="The food was absolutely stunning..."
                            rows={3}
                            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Rating (1–5 stars)</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setCardForm({ ...cardForm, rating: star })}
                                className={`text-2xl transition-transform hover:scale-110 ${
                                  (cardForm.rating || 0) >= star ? 'text-[#D4A853]' : 'text-[#DDD5C8]'
                                }`}
                              >
                                ★
                              </button>
                            ))}
                            <span className="text-sm text-[#8C8278] self-center ml-1">{cardForm.rating || 0}/5</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Reviewer Name</label>
                            <input
                              type="text"
                              value={cardForm.reviewer_name || ''}
                              onChange={(e) => setCardForm({ ...cardForm, reviewer_name: e.target.value })}
                              placeholder="e.g. Sarah M."
                              className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Event Type</label>
                            <input
                              type="text"
                              value={cardForm.reviewer_event || ''}
                              onChange={(e) => setCardForm({ ...cardForm, reviewer_event: e.target.value })}
                              placeholder="e.g. Wedding"
                              className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {cardFormError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{cardFormError}</div>
                    )}
                    {cardFormSuccess && (
                      <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">{cardFormSuccess}</div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCardForm(false)}
                        className="flex-1 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingCard}
                        className="flex-1 py-2.5 rounded-xl bg-[#C4622D] text-white text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {savingCard ? (
                          <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
                        ) : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-lg font-bold text-[#1A1612]">Homepage Hero Cards</h2>
              <p className="text-sm text-[#8C8278] mt-0.5">Control what appears in the floating cards on the homepage hero section</p>
            </div>

            {cardsLoading ? (
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : homepageCards.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-[#DDD5C8]">
                <div className="text-5xl mb-3">🏠</div>
                <p className="text-[#5C5347] font-semibold">No homepage cards found</p>
                <p className="text-[#B0A89E] text-sm mt-1">Run the database migration to seed the default cards</p>
              </div>
            ) : (
              <div className="space-y-4">
                {homepageCards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-white rounded-2xl border border-[#DDD5C8] p-5 flex items-center gap-4 hover:border-[#C4622D]/40 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#F5F0E8] flex items-center justify-center text-2xl flex-shrink-0">
                      {CARD_TYPE_ICONS[card.card_type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-mono text-[#C4622D] uppercase tracking-wider">
                          {CARD_TYPE_LABELS[card.card_type]}
                        </p>
                      </div>
                      <p className="font-semibold text-[#1A1612] text-sm truncate">{card.title}</p>
                      <p className="text-xs text-[#8C8278] mt-0.5">
                        {card.card_type === 'todays_special' && (
                          card.price != null
                            ? `R${card.price}${card.price_unit ? ` / ${card.price_unit}` : ''}${card.badge_label ? ` · ${card.badge_label}` : ''}`
                            : (card.subtitle || '').replace(/\$/g, 'R')
                        )}
                        {card.card_type === 'next_booking' && `${card.event_date || ''}${card.event_date && card.guest_count ? ' · ' : ''}${card.guest_count ? `${card.guest_count} guests` : ''}${card.prep_percentage !== null ? ` · ${card.prep_percentage}% prep` : ''}`}
                        {card.card_type === 'customer_review' && `${card.rating ? '★'.repeat(card.rating) : ''} ${card.reviewer_name || ''}${card.reviewer_event ? ` · ${card.reviewer_event}` : ''}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => handleToggleCardVisibility(card)}
                        disabled={togglingCardId === card.id}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                          card.is_visible ? 'bg-green-500 text-white' : 'bg-[#8C8278] text-white'
                        }`}
                        title={card.is_visible ? 'Click to hide' : 'Click to show'}
                      >
                        {togglingCardId === card.id ? (
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : card.is_visible ? 'Visible' : 'Hidden'}
                      </button>
                      <button
                        onClick={() => openCardEditForm(card)}
                        className="w-9 h-9 rounded-xl bg-[#F5F0E8] flex items-center justify-center text-[#5C5347] hover:bg-[#EDE7DA] transition-colors"
                        title="Edit card"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 bg-[#F5F0E8] border border-[#DDD5C8] rounded-xl p-4">
              <p className="text-sm font-semibold text-[#3D3530] mb-1">ℹ️ About Homepage Cards</p>
              <p className="text-xs text-[#5C5347] leading-relaxed">
                These three cards appear in the floating panel on the homepage hero section.
                Toggle visibility to show or hide individual cards on the live site. Click Edit to update the card content.
                Changes take effect immediately on the live homepage.
              </p>
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {activeTab === 'orders' && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-[#DDD5C8]">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-xl font-bold text-[#1A1612] mb-2">Orders Management</h2>
            <p className="text-[#8C8278] text-sm mb-6 text-center max-w-sm">
              View and manage all customer orders from the dedicated Orders page.
            </p>
            <a
              href="/staff/orders"
              className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
            >
              Go to Orders
            </a>
          </div>
        )}

        {/* ── STAFF MANAGEMENT TAB ── */}
        {activeTab === 'staff' && isSuperAdmin && (
          <div>
            {showInviteForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">Invite Staff Member</h2>
                    <button
                      onClick={() => { setShowInviteForm(false); setInviteError(''); setInviteSuccess(''); }}
                      className="w-8 h-8 rounded-full bg-[#F5F0E8] flex items-center justify-center text-[#8C8278] hover:bg-[#EDE7DA] transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleInviteStaff} className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Full Name *</label>
                      <input
                        type="text"
                        value={inviteForm.full_name}
                        onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                        placeholder="e.g. Jane Smith"
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Email Address *</label>
                      <input
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        placeholder="jane@example.com"
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Role *</label>
                      <select
                        value={inviteForm.role}
                        onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as StaffRole })}
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors bg-white"
                      >
                        <option value="staff">Staff — Products &amp; Services access</option>
                        <option value="admin">Admin — Full workspace access</option>
                      </select>
                    </div>
                    {inviteError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{inviteError}</div>
                    )}
                    {inviteSuccess && (
                      <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">{inviteSuccess}</div>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => { setShowInviteForm(false); setInviteError(''); setInviteSuccess(''); }}
                        className="flex-1 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={inviting}
                        className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {inviting ? (
                          <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending...</>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Invite Staff Member
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Staff Members</h2>
                <p className="text-sm text-[#8C8278] mt-0.5">Manage access for all staff members</p>
              </div>
              <button
                onClick={() => { setShowInviteForm(true); setInviteError(''); setInviteSuccess(''); }}
                className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite Staff Member
              </button>
            </div>

            {staffActionMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{staffActionMsg}</div>
            )}
            {resetPasswordMsg && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                {resetPasswordMsg}
              </div>
            )}

            {staffLoading ? (
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-purple-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : staffMembers.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-[#DDD5C8]">
                <div className="text-5xl mb-3">👥</div>
                <p className="text-[#5C5347] font-semibold">No staff members found</p>
                <p className="text-[#B0A89E] text-sm mt-1">Invite your first staff member above</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#DDD5C8] overflow-hidden">
                <div className="hidden md:grid grid-cols-5 gap-4 px-6 py-3 bg-[#F5F0E8] border-b border-[#DDD5C8] text-xs font-semibold text-[#8C8278] uppercase tracking-wider">
                  <div className="col-span-2">Name / Email</div>
                  <div>Role</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                {staffMembers.map((member, idx) => (
                  <div
                    key={member.id}
                    className={`px-6 py-4 flex flex-col md:grid md:grid-cols-5 md:items-center gap-3 md:gap-4 ${
                      idx < staffMembers.length - 1 ? 'border-b border-[#EDE7DA]' : ''
                    } ${!member.is_active ? 'bg-red-50/30' : ''}`}
                  >
                    <div className="col-span-2 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#F5F0E8] flex items-center justify-center text-sm font-bold text-[#C4622D] flex-shrink-0">
                        {member.full_name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1A1612] truncate">
                          {member.full_name || '—'}
                          {member.id === user?.id && (
                            <span className="ml-1.5 text-xs font-normal text-[#8C8278]">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-[#8C8278] truncate">{member.email}</p>
                      </div>
                    </div>
                    <div><RoleBadge role={member.role} /></div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        member.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        {member.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {member.id === user?.id ? (
                        <span className="text-xs text-[#B0A89E] italic">Your account</span>
                      ) : member.is_active ? (
                        <>
                          <button
                            onClick={() => handleSuspendStaff(member)}
                            disabled={staffActionId === member.id || resetPasswordId === member.id}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {staffActionId === member.id ? (
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            ) : (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            )}
                            Suspend
                          </button>
                          <button
                            onClick={() => handleResetPassword(member)}
                            disabled={resetPasswordId === member.id || staffActionId === member.id}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {resetPasswordId === member.id ? (
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            ) : (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.865a8.25 8.25 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            )}
                            Reset Password
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleReinstateStaff(member)}
                          disabled={staffActionId === member.id}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {staffActionId === member.id ? (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          ) : (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          Reinstate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-purple-800 mb-1">ℹ️ Super Admin Access</p>
              <p className="text-xs text-purple-700 leading-relaxed">
                As Super Admin, you can invite staff members (Admin or Staff role), suspend their access, reinstate suspended accounts, or reset their password.
                Resetting a password sends a secure email link to the staff member — they must set a new password before logging in again.
                Suspended staff will see an &quot;Account suspended — Contact your Admin&quot; message when they attempt to log in.
                You cannot suspend your own account.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
