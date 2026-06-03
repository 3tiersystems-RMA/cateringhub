import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductsInteractive from "./components/ProductsInteractive";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Menu & Order Online — ${APP_NAME}`,
  description:
    "Browse our full catering packages, weekly packaged meals, and à la carte platters. Order online with secure payment. Chef-crafted, locally sourced.",
  keywords: ["catering menu", "meal prep order", "food platters", "online catering order"],
};

export default function ProductsPage() {
  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-[#e9e0cf]">
        <ProductsInteractive />
      </main>
      <Footer />
    </>
  );
}