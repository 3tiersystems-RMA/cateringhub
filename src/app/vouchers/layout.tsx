import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Meal Voucher — ${APP_NAME}`,
  description: "Purchase meal vouchers for Cardamom Kitchen. Choose a package and redeem at checkout.",
};

export default function VouchersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
