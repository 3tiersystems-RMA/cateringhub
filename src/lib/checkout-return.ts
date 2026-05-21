/** Query params PayFast may append when redirecting to return_url / cancel_url. */
export function parseCheckoutReturnParams(
    searchParams: URLSearchParams | null
  ): {
    orderId: string;
    isPayFastReturn: boolean;
    paymentStatus: string;
  } {
    if (!searchParams) {
      return { orderId: "", isPayFastReturn: false, paymentStatus: "" };
    }
  
    const fromPayfast = searchParams.get("from") === "payfast";
    const mPaymentId = searchParams.get("m_payment_id")?.trim() || "";
    const pt = searchParams.get("pt")?.trim() || "";
    const pfPaymentId = searchParams.get("pf_payment_id")?.trim() || "";
    const paymentStatus = searchParams.get("payment_status")?.trim() || "";
    const orderIdFallback = searchParams.get("order_id")?.trim() || "";
  
    const orderId = mPaymentId || pt || orderIdFallback;
  
    const isPayFastReturn =
      fromPayfast ||
      Boolean(mPaymentId) ||
      Boolean(pt) ||
      Boolean(pfPaymentId) ||
      Boolean(paymentStatus);
  
    return { orderId, isPayFastReturn, paymentStatus };
  }
  
  export function formatPaymentMethodLabel(
    method: string | null | undefined
  ): string {
    switch ((method || "").toLowerCase()) {
      case "payfast":
        return "PayFast";
      case "eft":
        return "EFT";
      case "voucher":
        return "Meal Voucher";
      default:
        return method ? method : "EFT";
    }
  }
  