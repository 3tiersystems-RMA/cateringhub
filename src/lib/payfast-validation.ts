/**
 * Client-safe PayFast validation helpers (no server credentials or secrets).
 */

/** Normalize to PayFast's expected SA local mobile format (e.g. 0821234567). */
export function formatPayFastCellNumber(cell: string): string | null {
  let digits = cell.replace(/\D/g, "");
  if (digits.startsWith("27") && digits.length === 11) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.length === 9) {
    digits = `0${digits}`;
  }
  if (digits.length !== 10 || digits[0] !== "0") {
    return null;
  }
  if (!/^0[678]\d{8}$/.test(digits)) {
    return null;
  }
  return digits;
}

export function validateSAMobileForPayFast(cell: string): string | null {
  if (!cell.trim()) {
    return "Cellphone number is required";
  }
  if (!formatPayFastCellNumber(cell)) {
    return "Mobile number must be a valid South African number (e.g. 0821234567)";
  }
  return null;
}
