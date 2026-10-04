'use client';

import React, { useState } from 'react';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  notes?: string;
}

interface TableDef {
  name: string;
  description: string;
  columns: Column[];
}

const SCHEMA_TABLES: TableDef[] = [
  {
    name: 'user_profiles',
    description: 'Staff and admin user profiles linked to Supabase auth.users',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: '—', notes: 'FK → auth.users(id)' },
      { name: 'email', type: 'TEXT', nullable: false, default: '—' },
      { name: 'full_name', type: 'TEXT', nullable: false, default: "''" },
      { name: 'role', type: 'staff_role ENUM', nullable: true, default: "'staff'", notes: "admin | staff | super_admin" },
      { name: 'is_active', type: 'BOOLEAN', nullable: true, default: 'true' },
      { name: 'phone', type: 'TEXT', nullable: true, default: 'NULL' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'orders',
    description: 'Customer orders placed via PayFast or EFT payment',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'payfast_transaction_id', type: 'TEXT', nullable: true },
      { name: 'm_payment_id', type: 'TEXT', nullable: true, notes: 'UNIQUE' },
      { name: 'customer_name', type: 'TEXT', nullable: false, default: "''" },
      { name: 'customer_email', type: 'TEXT', nullable: false, default: "''" },
      { name: 'customer_phone', type: 'TEXT', nullable: true, default: "''" },
      { name: 'items', type: 'JSONB', nullable: false, default: "'[]'" },
      { name: 'subtotal', type: 'NUMERIC(10,2)', nullable: false, default: '0' },
      { name: 'delivery_fee', type: 'NUMERIC(10,2)', nullable: false, default: '0' },
      { name: 'total', type: 'NUMERIC(10,2)', nullable: false, default: '0' },
      { name: 'payment_status', type: 'payment_status ENUM', nullable: false, default: "'pending'", notes: 'pending | paid | failed | awaiting_payment | awaiting_confirmation | discounted | unpaid' },
      { name: 'fulfillment_status', type: 'fulfillment_status ENUM', nullable: false, default: "'new'", notes: 'new | confirmed | preparing | ready | delivered | collected' },
      { name: 'payment_method', type: 'TEXT', nullable: true, default: "'payfast'" },
      { name: 'event_date', type: 'DATE', nullable: true },
      { name: 'delivery_address', type: 'TEXT', nullable: true, default: "''" },
      { name: 'notes', type: 'TEXT', nullable: true, default: "''" },
      { name: 'delivered_date', type: 'DATE', nullable: true },
      { name: 'last_reminder_sent_at', type: 'TIMESTAMPTZ', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'order_audit_trail',
    description: 'Audit log of every status change on an order',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'order_id', type: 'UUID', nullable: false, notes: 'FK → orders(id)' },
      { name: 'event_type', type: 'TEXT', nullable: false },
      { name: 'field_changed', type: 'TEXT', nullable: false },
      { name: 'old_value', type: 'TEXT', nullable: true },
      { name: 'new_value', type: 'TEXT', nullable: false },
      { name: 'changed_by', type: 'TEXT', nullable: false, default: "'system'" },
      { name: 'notes', type: 'TEXT', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'products',
    description: 'Product catalogue for catering packages, packaged meals, and à la carte items',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'category', type: 'TEXT', nullable: false },
      { name: 'price', type: 'DECIMAL(10,2)', nullable: false },
      { name: 'unit', type: 'TEXT', nullable: false, default: "'per serving'" },
      { name: 'image_path', type: 'TEXT', nullable: true },
      { name: 'description', type: 'TEXT', nullable: false, default: "''" },
      { name: 'tags', type: 'TEXT[]', nullable: true, default: 'ARRAY[]' },
      { name: 'badge', type: 'TEXT', nullable: true },
      { name: 'min_order', type: 'INTEGER', nullable: true },
      { name: 'available', type: 'BOOLEAN', nullable: true, default: 'true' },
      { name: 'featured', type: 'BOOLEAN', nullable: true, default: 'false' },
      { name: 'sort_order', type: 'INTEGER', nullable: true, default: '0' },
      { name: 'package_type', type: 'TEXT', nullable: false, default: "'none'", notes: 'none | package-6 | package-12 | package-24' },
      { name: 'visual_type', type: 'TEXT', nullable: true },
      { name: 'old_price', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'saving', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'lead_time_days', type: 'INTEGER', nullable: true },
      { name: 'image_fit', type: 'TEXT', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'categories',
    description: 'Product categories (replaces product_category enum)',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'name', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'slug', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'active', type: 'BOOLEAN', nullable: false, default: 'true' },
      { name: 'sort_order', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'weekly_menu',
    description: 'Weekly meal menu displayed on the public website',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'meal_date', type: 'DATE', nullable: false },
      { name: 'day_name', type: 'TEXT', nullable: false },
      { name: 'meal_name', type: 'TEXT', nullable: true },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'price', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'is_closed', type: 'BOOLEAN', nullable: false, default: 'false' },
      { name: 'closed_reason', type: 'TEXT', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'vouchers',
    description: 'Meal vouchers purchased by customers',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'voucher_code', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'customer_name', type: 'TEXT', nullable: false, default: "''" },
      { name: 'customer_email', type: 'TEXT', nullable: false, default: "''" },
      { name: 'customer_phone', type: 'TEXT', nullable: true },
      { name: 'total_meals', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'meals_remaining', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'status', type: 'voucher_status ENUM', nullable: false, default: "'active'", notes: 'active | redeemed | expired | unpaid' },
      { name: 'purchased_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'notes', type: 'TEXT', nullable: true },
      { name: 'package_type', type: 'TEXT', nullable: true },
      { name: 'meal_name', type: 'TEXT', nullable: true },
      { name: 'meal_description', type: 'TEXT', nullable: true },
      { name: 'meal_price', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'voucher_redemptions',
    description: 'Audit trail of meal voucher redemptions',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'voucher_code', type: 'TEXT', nullable: false, notes: 'FK → vouchers(voucher_code)' },
      { name: 'order_id', type: 'TEXT', nullable: true, default: "''" },
      { name: 'meals_used', type: 'INTEGER', nullable: false, default: '1' },
      { name: 'redeemed_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'notes', type: 'TEXT', nullable: true },
    ],
  },
  {
    name: 'discount_vouchers',
    description: 'Staff-generated discount coupons applied at checkout',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'dv_code', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'dv_amount', type: 'NUMERIC(10,2)', nullable: false, default: '0' },
      { name: 'status', type: 'discount_voucher_status ENUM', nullable: false, default: "'Active'", notes: 'Active | Inactive' },
      { name: 'expiry_date', type: 'DATE', nullable: false },
      { name: 'times_used', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'homepage_cards',
    description: "Dynamic hero cards on the homepage (today's special, next booking, review)",
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'card_type', type: 'homepage_card_type ENUM', nullable: false, notes: 'todays_special | next_booking | customer_review' },
      { name: 'title', type: 'TEXT', nullable: false, default: "''" },
      { name: 'subtitle', type: 'TEXT', nullable: true },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'price', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'price_unit', type: 'TEXT', nullable: true },
      { name: 'badge_label', type: 'TEXT', nullable: true },
      { name: 'event_date', type: 'TEXT', nullable: true },
      { name: 'guest_count', type: 'INTEGER', nullable: true },
      { name: 'prep_percentage', type: 'INTEGER', nullable: true, notes: '0–100' },
      { name: 'reviewer_name', type: 'TEXT', nullable: true },
      { name: 'reviewer_event', type: 'TEXT', nullable: true },
      { name: 'rating', type: 'INTEGER', nullable: true, notes: '1–5' },
      { name: 'image_url', type: 'TEXT', nullable: true },
      { name: 'product_link', type: 'TEXT', nullable: true },
      { name: 'is_visible', type: 'BOOLEAN', nullable: false, default: 'true' },
      { name: 'display_order', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'NOW()' },
    ],
  },
  {
    name: 'homepage_section_settings',
    description: 'Visibility toggles and settings for homepage sections',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'section_key', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'section_label', type: 'TEXT', nullable: false },
      { name: 'is_visible', type: 'BOOLEAN', nullable: true, default: 'true' },
      { name: 'banner_text', type: 'TEXT', nullable: true },
      { name: 'hero_badge_text', type: 'TEXT', nullable: true },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'testimonials',
    description: 'Customer testimonials displayed on the homepage',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'quote', type: 'TEXT', nullable: false },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'role', type: 'TEXT', nullable: false },
      { name: 'avatar_url', type: 'TEXT', nullable: true },
      { name: 'rating', type: 'INTEGER', nullable: false, default: '5', notes: '1–5' },
      { name: 'is_active', type: 'BOOLEAN', nullable: false, default: 'true' },
      { name: 'display_order', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'gallery_images',
    description: 'Images displayed in the homepage gallery section',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'title', type: 'TEXT', nullable: false },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'image_path', type: 'TEXT', nullable: false },
      { name: 'sort_order', type: 'INTEGER', nullable: true, default: '0' },
      { name: 'is_visible', type: 'BOOLEAN', nullable: true, default: 'true' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'gallery_settings',
    description: 'Global visibility toggle for the gallery section',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'section_visible', type: 'BOOLEAN', nullable: true, default: 'true' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'social_links',
    description: 'Social media platform URLs shown in the footer',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'platform', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'url', type: 'TEXT', nullable: false, default: "'#'" },
      { name: 'display_order', type: 'INTEGER', nullable: true, default: '0' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'events',
    description: 'Marketing events published on the public events page',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'title', type: 'TEXT', nullable: false },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'event_date', type: 'TIMESTAMPTZ', nullable: false },
      { name: 'end_date', type: 'TIMESTAMPTZ', nullable: true },
      { name: 'location', type: 'TEXT', nullable: true },
      { name: 'image_path', type: 'TEXT', nullable: true },
      { name: 'image_url', type: 'TEXT', nullable: true },
      { name: 'is_published', type: 'BOOLEAN', nullable: true, default: 'false' },
      { name: 'is_registered', type: 'BOOLEAN', nullable: true, default: 'false' },
      { name: 'cost', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'enrollment_url', type: 'TEXT', nullable: true },
      { name: 'event_menu', type: 'TEXT', nullable: true },
      { name: 'badge_tags', type: 'TEXT[]', nullable: true },
      { name: 'splash_banner_url', type: 'TEXT', nullable: true },
      { name: 'created_by', type: 'UUID', nullable: true, notes: 'FK → user_profiles(id)' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'drive_documents',
    description: 'Google Drive documents linked for staff document management',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'file_id', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'file_type', type: 'TEXT', nullable: false, default: "'other'" },
      { name: 'embed_url', type: 'TEXT', nullable: false },
      { name: 'original_url', type: 'TEXT', nullable: false },
      { name: 'title', type: 'TEXT', nullable: false },
      { name: 'folder_name', type: 'TEXT', nullable: false, default: "'General'" },
      { name: 'created_time', type: 'TEXT', nullable: true },
      { name: 'modified_time', type: 'TEXT', nullable: true },
      { name: 'added_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'correspondence_settings',
    description: 'Settings used in email correspondence and order forms',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'form_header_title', type: 'TEXT', nullable: false, default: "'Cardamom Catering'" },
      { name: 'logo_url', type: 'TEXT', nullable: true },
      { name: 'terms_and_conditions', type: 'TEXT', nullable: true },
      { name: 'sales_representative', type: 'TEXT', nullable: true },
      { name: 'office_number', type: 'TEXT', nullable: true },
      { name: 'comments', type: 'TEXT', nullable: true },
      { name: 'banking_details', type: 'TEXT', nullable: true },
      { name: 'info_email', type: 'TEXT', nullable: true },
      { name: 'main_email', type: 'TEXT', nullable: true },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'guest_carts',
    description: 'Persistent shopping cart storage for unauthenticated customers',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'guest_token', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'items', type: 'JSONB', nullable: false, default: "'[]'" },
      { name: 'customer_email', type: 'TEXT', nullable: true },
      { name: 'customer_name', type: 'TEXT', nullable: true },
      { name: 'last_activity_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
      { name: 'reminder_sent_at', type: 'TIMESTAMPTZ', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
    ],
  },
  {
    name: 'cooking_class_settings',
    description: 'Global settings for the cooking & baking class registration system',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'flyer_image_url', type: 'TEXT', nullable: true },
      { name: 'flyer_image_path', type: 'TEXT', nullable: true },
      { name: 'sheet_id', type: 'TEXT', nullable: true },
      { name: 'sheet_name', type: 'TEXT', nullable: true },
      { name: 'class_fee', type: 'NUMERIC(10,2)', nullable: true, default: '0' },
      { name: 'online_form_status', type: 'TEXT', nullable: true, default: "'active'" },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'cooking_class_registrations',
    description: 'Customer registrations for cooking & baking classes',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'title', type: 'TEXT', nullable: false },
      { name: 'first_name', type: 'TEXT', nullable: false },
      { name: 'surname', type: 'TEXT', nullable: false },
      { name: 'email', type: 'TEXT', nullable: false },
      { name: 'cellphone', type: 'TEXT', nullable: false },
      { name: 'selected_events', type: 'TEXT[]', nullable: false, default: "'{}'" },
      { name: 'adult_class_dates', type: 'TEXT[]', nullable: false, default: "'{}'" },
      { name: 'payment_method', type: 'TEXT', nullable: false, default: "'payfast'" },
      { name: 'payment_status', type: 'TEXT', nullable: false, default: "'pending'" },
      { name: 'proof_of_payment_url', type: 'TEXT', nullable: true },
      { name: 'proof_of_payment_path', type: 'TEXT', nullable: true },
      { name: 'payfast_payment_id', type: 'TEXT', nullable: true },
      { name: 'amount', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'synced_to_sheet', type: 'BOOLEAN', nullable: true, default: 'false' },
      { name: 'sheet_row_id', type: 'TEXT', nullable: true },
      { name: 'notes', type: 'TEXT', nullable: true },
      { name: 'registration_code', type: 'TEXT', nullable: true },
      { name: 'type', type: 'TEXT', nullable: true, notes: 'adult | child | mixed' },
      { name: 'skill_level', type: 'TEXT', nullable: true },
      { name: 'payfast_itn_data', type: 'JSONB', nullable: true },
      { name: 'payfast_confirmation_email_sent_at', type: 'TIMESTAMPTZ', nullable: true },
      { name: 'payfast_confirmation_email_error', type: 'TEXT', nullable: true },
      { name: 'payfast_confirmation_email_resend_id', type: 'TEXT', nullable: true },
      { name: 'confirmation_email_recipients', type: 'JSONB', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'cooking_class_name',
    description: 'In-person cooking & baking class types (renamed from cooking_classes)',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'instructor', type: 'TEXT', nullable: true },
      { name: 'sort_order', type: 'INTEGER', nullable: true, default: '0' },
      { name: 'is_active', type: 'BOOLEAN', nullable: true, default: 'true' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'cooking_class_sessions',
    description: 'Scheduled sessions for an in-person class (renamed from cooking_class_event_dates)',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'class_id', type: 'UUID', nullable: true, notes: 'FK → cooking_class_name(id)' },
      { name: 'event_date', type: 'DATE', nullable: true },
      { name: 'start_time', type: 'TEXT', nullable: true },
      { name: 'end_time', type: 'TEXT', nullable: true },
      { name: 'location', type: 'TEXT', nullable: true, default: "'12 Cardamom Street, Cape Town, 7441'" },
      { name: 'class_fee', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'child_fee', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'seating', type: 'INTEGER', nullable: true },
      { name: 'status_id', type: 'UUID', nullable: true },
      { name: 'session_name', type: 'TEXT', nullable: true },
      { name: 'sort_order', type: 'INTEGER', nullable: true, default: '0' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'booking_counts',
    description: 'Links cooking class registrations to specific session dates',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'registration_id', type: 'UUID', nullable: true, notes: 'FK → cooking_class_registrations(id)' },
      { name: 'event_date_id', type: 'UUID', nullable: true, notes: 'FK → cooking_class_sessions(id)' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
    ],
  },
  {
    name: 'event_management_settings',
    description: 'Global settings for the event booking management system',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'flyer_image_url', type: 'TEXT', nullable: true },
      { name: 'flyer_image_path', type: 'TEXT', nullable: true },
      { name: 'sheet_id', type: 'TEXT', nullable: true },
      { name: 'sheet_name', type: 'TEXT', nullable: true, default: "'Registrations'" },
      { name: 'event_fee', type: 'NUMERIC(10,2)', nullable: false, default: '0' },
      { name: 'online_form_status', type: 'TEXT', nullable: true, default: "'active'" },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
    ],
  },
  {
    name: 'event_management_events',
    description: 'Event types for the event booking management system',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'sort_order', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'is_active', type: 'BOOLEAN', nullable: false, default: 'true' },
      { name: 'badge_tags', type: 'TEXT[]', nullable: true },
      { name: 'whatsapp_session_name', type: 'TEXT', nullable: true },
      { name: 'event_images', type: 'JSONB', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
    ],
  },
  {
    name: 'event_management_session_statuses',
    description: 'Lookup table for session status labels (e.g. Open, Closed, Full)',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'label', type: 'TEXT', nullable: false },
      { name: 'sort_order', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
    ],
  },
  {
    name: 'event_management_event_dates',
    description: 'Scheduled session dates for event management events',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'event_id', type: 'UUID', nullable: true, notes: 'FK → event_management_events(id)' },
      { name: 'event_date', type: 'DATE', nullable: true },
      { name: 'start_time', type: 'TIME', nullable: true },
      { name: 'end_time', type: 'TIME', nullable: true },
      { name: 'location', type: 'TEXT', nullable: true },
      { name: 'sort_order', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'seating', type: 'INTEGER', nullable: false, default: '0' },
      { name: 'status_id', type: 'UUID', nullable: true, notes: 'FK → event_management_session_statuses(id)' },
      { name: 'event_fee', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
    ],
  },
  {
    name: 'event_management_registrations',
    description: 'Customer registrations for managed events (e.g. Soccer School Holiday Program)',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'title', type: 'TEXT', nullable: true },
      { name: 'first_name', type: 'TEXT', nullable: false },
      { name: 'surname', type: 'TEXT', nullable: false },
      { name: 'email', type: 'TEXT', nullable: false },
      { name: 'cellphone', type: 'TEXT', nullable: false },
      { name: 'selected_events', type: 'TEXT[]', nullable: true, default: "'{}'" },
      { name: 'adult_class_dates', type: 'TEXT[]', nullable: true, default: "'{}'" },
      { name: 'relationship', type: 'TEXT', nullable: true },
      { name: 'first_time_portal', type: 'TEXT', nullable: true },
      { name: 'allergies_illness', type: 'TEXT', nullable: true },
      { name: 'rsa_id_passport', type: 'TEXT', nullable: true },
      { name: 'emergency_contact1', type: 'JSONB', nullable: true },
      { name: 'emergency_contact2', type: 'JSONB', nullable: true },
      { name: 'medical_doctor_first_name', type: 'TEXT', nullable: true },
      { name: 'medical_doctor_surname', type: 'TEXT', nullable: true },
      { name: 'medical_aid_name', type: 'TEXT', nullable: true },
      { name: 'medical_aid_number', type: 'TEXT', nullable: true },
      { name: 'children', type: 'JSONB', nullable: true, default: "'[]'" },
      { name: 'attend_school_holiday', type: 'TEXT', nullable: true },
      { name: 'pictures_taken', type: 'TEXT', nullable: true },
      { name: 'indemnity_consent', type: 'BOOLEAN', nullable: true },
      { name: 'indemnity_file_url', type: 'TEXT', nullable: true },
      { name: 'payment_method', type: 'TEXT', nullable: false, default: "'eft'" },
      { name: 'payment_status', type: 'TEXT', nullable: false, default: "'pending'" },
      { name: 'amount', type: 'NUMERIC(10,2)', nullable: true },
      { name: 'proof_of_payment_url', type: 'TEXT', nullable: true },
      { name: 'proof_of_payment_path', type: 'TEXT', nullable: true },
      { name: 'proof_of_payment_drive_url', type: 'TEXT', nullable: true },
      { name: 'payfast_payment_id', type: 'TEXT', nullable: true },
      { name: 'synced_to_sheet', type: 'BOOLEAN', nullable: false, default: 'false' },
      { name: 'notes', type: 'TEXT', nullable: true },
      { name: 'registration_code', type: 'TEXT', nullable: true },
      { name: 'payfast_confirmation_email_sent_at', type: 'TIMESTAMPTZ', nullable: true },
      { name: 'payfast_confirmation_email_error', type: 'TEXT', nullable: true },
      { name: 'payfast_confirmation_email_resend_id', type: 'TEXT', nullable: true },
      { name: 'confirmation_email_recipients', type: 'JSONB', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
    ],
  },
  {
    name: 'event_management_booking_counts',
    description: 'Links event registrations to specific session dates',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'registration_id', type: 'UUID', nullable: true, notes: 'FK → event_management_registrations(id)' },
      { name: 'event_date_id', type: 'UUID', nullable: true, notes: 'FK → event_management_event_dates(id)' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
    ],
  },
  {
    name: 'booking_statuses',
    description: 'Lookup table for booking/registration payment statuses',
    columns: [
      { name: 'id', type: 'TEXT', nullable: false, notes: 'PK (e.g. pending, paid, no-show)' },
      { name: 'label', type: 'TEXT', nullable: false },
      { name: 'sort_order', type: 'INTEGER', nullable: true, default: '0' },
    ],
  },
  {
    name: 'customer_credits',
    description: 'Credit balances issued to customers (e.g. for no-shows)',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'customer_email', type: 'TEXT', nullable: false },
      { name: 'customer_name', type: 'TEXT', nullable: false },
      { name: 'original_booking_ref', type: 'TEXT', nullable: false },
      { name: 'booking_type', type: 'TEXT', nullable: false, notes: 'class | event' },
      { name: 'total_issued', type: 'NUMERIC(10,2)', nullable: false },
      { name: 'total_used', type: 'NUMERIC(10,2)', nullable: false, default: '0' },
      { name: 'remaining_balance', type: 'NUMERIC(10,2)', nullable: false },
      { name: 'credit_status', type: 'TEXT', nullable: false, default: "'active'", notes: 'active | used' },
      { name: 'issued_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
      { name: 'notes', type: 'TEXT', nullable: true },
    ],
  },
  {
    name: 'customer_credit_transactions',
    description: 'Audit trail of credit applications against bookings',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'credit_id', type: 'UUID', nullable: false, notes: 'FK → customer_credits(id)' },
      { name: 'booking_ref', type: 'TEXT', nullable: false },
      { name: 'booking_type', type: 'TEXT', nullable: false, notes: 'class | event' },
      { name: 'amount_applied', type: 'NUMERIC(10,2)', nullable: false },
      { name: 'balance_before', type: 'NUMERIC(10,2)', nullable: false },
      { name: 'balance_after', type: 'NUMERIC(10,2)', nullable: false },
      { name: 'applied_by', type: 'TEXT', nullable: false, default: "'system'" },
      { name: 'applied_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
      { name: 'notes', type: 'TEXT', nullable: true },
    ],
  },
  {
    name: 'payfast_pending_payments',
    description: 'Temporary storage of payment payload before PayFast ITN confirmation',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'm_payment_id', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'payment_type', type: 'TEXT', nullable: false, notes: 'order | event_booking | cooking_class' },
      { name: 'payload', type: 'JSONB', nullable: false },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
      { name: 'expires_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now() + 2 hours' },
    ],
  },
  {
    name: 'global_settings',
    description: 'Global feature toggles (e.g. payment method visibility)',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'setting_key', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'setting_label', type: 'TEXT', nullable: false },
      { name: 'is_enabled', type: 'BOOLEAN', nullable: false, default: 'true' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'now()' },
      { name: 'updated_by', type: 'UUID', nullable: true, notes: 'FK → user_profiles(id)' },
    ],
  },
  {
    name: 'org_entities',
    description: 'Organisation legal entities',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'org_banking_details',
    description: 'Banking details per organisation entity',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'entity_id', type: 'UUID', nullable: false, notes: 'FK → org_entities(id)' },
      { name: 'bank_name', type: 'TEXT', nullable: false },
      { name: 'account_name', type: 'TEXT', nullable: false },
      { name: 'account_number', type: 'TEXT', nullable: false },
      { name: 'branch_code', type: 'TEXT', nullable: false },
      { name: 'account_type', type: 'TEXT', nullable: true },
      { name: 'reference', type: 'TEXT', nullable: true },
      { name: 'is_default', type: 'BOOLEAN', nullable: false, default: 'false' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'org_warehouses',
    description: 'Warehouse / site locations per organisation entity',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'entity_id', type: 'UUID', nullable: false, notes: 'FK → org_entities(id)' },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'address', type: 'TEXT', nullable: false },
      { name: 'city', type: 'TEXT', nullable: true },
      { name: 'province', type: 'TEXT', nullable: true },
      { name: 'postal_code', type: 'TEXT', nullable: true },
      { name: 'country', type: 'TEXT', nullable: false, default: "'South Africa'" },
      { name: 'is_default', type: 'BOOLEAN', nullable: false, default: 'false' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'org_contacts',
    description: 'Contact persons per organisation entity',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'entity_id', type: 'UUID', nullable: false, notes: 'FK → org_entities(id)' },
      { name: 'contact_name', type: 'TEXT', nullable: false },
      { name: 'email', type: 'TEXT', nullable: true },
      { name: 'office_number', type: 'TEXT', nullable: true },
      { name: 'mobile_number', type: 'TEXT', nullable: true },
      { name: 'office_is_default', type: 'BOOLEAN', nullable: false, default: 'false' },
      { name: 'mobile_is_default', type: 'BOOLEAN', nullable: false, default: 'false' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
  {
    name: 'visual_types',
    description: 'Lookup table for product visual types (Macro, Micro)',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()' },
      { name: 'name', type: 'TEXT', nullable: false, notes: 'UNIQUE' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: true, default: 'CURRENT_TIMESTAMP' },
    ],
  },
];

function generateSQL(): string {
  const lines: string[] = [];
  lines.push('-- ============================================================');
  lines.push('-- Cardamom Kitchen — Complete Database Schema');
  lines.push(`-- Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push('-- ============================================================');
  lines.push('');
  lines.push('-- ENUMS');
  lines.push("CREATE TYPE public.staff_role AS ENUM ('admin', 'staff', 'super_admin');");
  lines.push("CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'awaiting_payment', 'awaiting_confirmation', 'discounted', 'unpaid');");
  lines.push("CREATE TYPE public.fulfillment_status AS ENUM ('new', 'confirmed', 'preparing', 'ready', 'delivered', 'collected');");
  lines.push("CREATE TYPE public.voucher_status AS ENUM ('active', 'redeemed', 'expired', 'unpaid');");
  lines.push("CREATE TYPE public.discount_voucher_status AS ENUM ('Active', 'Inactive');");
  lines.push("CREATE TYPE public.homepage_card_type AS ENUM ('todays_special', 'next_booking', 'customer_review');");
  lines.push('');

  for (const table of SCHEMA_TABLES) {
    lines.push(`-- ------------------------------------------------------------`);
    lines.push(`-- ${table.name}`);
    lines.push(`-- ${table.description}`);
    lines.push(`-- ------------------------------------------------------------`);
    lines.push(`CREATE TABLE IF NOT EXISTS public.${table.name} (`);
    const colLines = table.columns.map((col, i) => {
      const nullable = col.nullable ? '' : ' NOT NULL';
      const def = col.default ? ` DEFAULT ${col.default}` : '';
      const comma = i < table.columns.length - 1 ? ',' : '';
      const comment = col.notes ? ` -- ${col.notes}` : '';
      return `  ${col.name} ${col.type}${nullable}${def}${comma}${comment}`;
    });
    lines.push(...colLines);
    lines.push(');');
    lines.push('');
  }

  return lines.join('\n');
}

const CATEGORY_COLORS: Record<string, string> = {
  'Auth & Users': 'bg-violet-100 text-violet-800',
  'Orders & Payments': 'bg-blue-100 text-blue-800',
  'Products & Catalogue': 'bg-emerald-100 text-emerald-800',
  'Vouchers': 'bg-amber-100 text-amber-800',
  'Homepage & Content': 'bg-pink-100 text-pink-800',
  'Cooking Classes': 'bg-orange-100 text-orange-800',
  'Event Management': 'bg-cyan-100 text-cyan-800',
  'Credits & Statuses': 'bg-indigo-100 text-indigo-800',
  'Organisation': 'bg-teal-100 text-teal-800',
  'Settings & Config': 'bg-gray-100 text-gray-700',
};

const TABLE_CATEGORIES: Record<string, string> = {
  user_profiles: 'Auth & Users',
  orders: 'Orders & Payments',
  order_audit_trail: 'Orders & Payments',
  payfast_pending_payments: 'Orders & Payments',
  products: 'Products & Catalogue',
  categories: 'Products & Catalogue',
  visual_types: 'Products & Catalogue',
  weekly_menu: 'Products & Catalogue',
  vouchers: 'Vouchers',
  voucher_redemptions: 'Vouchers',
  discount_vouchers: 'Vouchers',
  homepage_cards: 'Homepage & Content',
  homepage_section_settings: 'Homepage & Content',
  testimonials: 'Homepage & Content',
  gallery_images: 'Homepage & Content',
  gallery_settings: 'Homepage & Content',
  social_links: 'Homepage & Content',
  events: 'Homepage & Content',
  drive_documents: 'Homepage & Content',
  cooking_class_settings: 'Cooking Classes',
  cooking_class_registrations: 'Cooking Classes',
  cooking_class_name: 'Cooking Classes',
  cooking_class_sessions: 'Cooking Classes',
  booking_counts: 'Cooking Classes',
  event_management_settings: 'Event Management',
  event_management_events: 'Event Management',
  event_management_session_statuses: 'Event Management',
  event_management_event_dates: 'Event Management',
  event_management_registrations: 'Event Management',
  event_management_booking_counts: 'Event Management',
  booking_statuses: 'Credits & Statuses',
  customer_credits: 'Credits & Statuses',
  customer_credit_transactions: 'Credits & Statuses',
  org_entities: 'Organisation',
  org_banking_details: 'Organisation',
  org_warehouses: 'Organisation',
  org_contacts: 'Organisation',
  correspondence_settings: 'Settings & Config',
  guest_carts: 'Settings & Config',
  global_settings: 'Settings & Config',
};

export default function DatabaseSchema() {
  const [search, setSearch] = useState('');
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', ...Object.keys(CATEGORY_COLORS)];

  const filtered = SCHEMA_TABLES.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === 'All' || TABLE_CATEGORIES[t.name] === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDownloadSQL = () => {
    const sql = generateSQL();
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cardamom-kitchen-schema-${new Date().toISOString().split('T')[0]}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const json = JSON.stringify(SCHEMA_TABLES, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cardamom-kitchen-schema-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Database Schema</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {SCHEMA_TABLES.length} tables · Supabase PostgreSQL
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadSQL}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download SQL
          </button>
          <button
            onClick={handleDownloadJSON}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download JSON
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Tables', value: SCHEMA_TABLES.length },
          { label: 'Total Columns', value: SCHEMA_TABLES.reduce((s, t) => s + t.columns.length, 0) },
          { label: 'Categories', value: Object.keys(CATEGORY_COLORS).length },
          { label: 'Migrations', value: '80+' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search tables or descriptions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-gray-900 text-white' :'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No tables match your search.</div>
        )}
        {filtered.map((table) => {
          const category = TABLE_CATEGORIES[table.name] ?? 'Settings & Config';
          const colorClass = CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-700';
          const isExpanded = expandedTable === table.name;

          return (
            <div key={table.name} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedTable(isExpanded ? null : table.name)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <code className="text-sm font-mono font-semibold text-gray-900 truncate">
                    {table.name}
                  </code>
                  <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                    {category}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-xs text-gray-400">{table.columns.length} cols</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100">
                  <div className="px-5 py-3 bg-gray-50 text-xs text-gray-500 italic">
                    {table.description}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Column</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nullable</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Default</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns.map((col, idx) => (
                          <tr key={col.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-5 py-2.5">
                              <code className="text-xs font-mono font-medium text-gray-900">{col.name}</code>
                            </td>
                            <td className="px-4 py-2.5">
                              <code className="text-xs font-mono text-blue-700">{col.type}</code>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${col.nullable ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600'}`}>
                                {col.nullable ? 'YES' : 'NO'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {col.default ? (
                                <code className="text-xs font-mono text-emerald-700">{col.default}</code>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{col.notes ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
