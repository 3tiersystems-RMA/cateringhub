-- Update discount_vouchers: set status to 'Inactive' where expiry_date is in the past
-- discount_vouchers uses 'Active'/'Inactive' enum values (case-sensitive)
UPDATE public.discount_vouchers
SET status = 'Inactive'
WHERE expiry_date < CURRENT_DATE
  AND status = 'Active';

-- Note: The vouchers (meal vouchers) table does not have an expiry_date column,
-- so expiry is managed manually via the status field when staff update it.

-- Create a helper function to auto-expire discount vouchers
-- This can be called on demand or via a scheduled job
CREATE OR REPLACE FUNCTION public.expire_past_discount_vouchers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.discount_vouchers
  SET status = 'Inactive'
  WHERE expiry_date < CURRENT_DATE
    AND status = 'Active';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

-- Grant execute to authenticated users (staff can trigger this)
GRANT EXECUTE ON FUNCTION public.expire_past_discount_vouchers() TO authenticated;
