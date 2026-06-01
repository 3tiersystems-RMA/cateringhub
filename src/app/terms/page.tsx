'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const sections = [
  { id: 'section-1', label: 'Introduction' },
  { id: 'section-2', label: 'Order Acceptance' },
  { id: 'section-3', label: 'Pricing and Payment' },
  { id: 'section-4', label: 'Shipping and Delivery' },
  { id: 'section-5', label: 'Returns and Refunds' },
  { id: 'section-6', label: 'Product Information' },
  { id: 'section-7', label: 'Limitation of Liability' },
  { id: 'section-8', label: 'Intellectual Property' },
  { id: 'section-9', label: 'Governing Law' },
  { id: 'section-10', label: 'Changes to Terms' },
  { id: 'section-11', label: 'Contact Us' },
];

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState('section-1');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0,
    });

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 100;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#DDD4CB]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 pt-28 pb-16">

          {/* Page Title */}
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-[#3D2B1F] mb-2">Terms &amp; Conditions</h1>
            <p className="text-sm text-[#8C8278]">Effective Date: 1 September 2024</p>
          </div>

          <div className="flex gap-8 items-start">

            {/* Sticky Contents Card */}
            <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-24">
              <div className="bg-white rounded-2xl shadow-sm border border-[#C8BFB5] p-6">
                <p className="text-xs font-bold tracking-widest text-[#3D2B1F] uppercase mb-4">Contents</p>
                <nav className="space-y-1">
                  {sections.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className={`w-full text-left flex items-start gap-2 py-1.5 px-1 rounded text-sm transition-colors ${
                        activeSection === s.id
                          ? 'text-[#C4622D] font-semibold'
                          : 'text-[#5C4A3A] hover:text-[#C4622D]'
                      }`}
                    >
                      <span className="flex-shrink-0 font-semibold w-5 text-right text-[#C4622D]">
                        {i + 1}.
                      </span>
                      <span className="leading-snug">{s.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Body Content */}
            <div className="flex-1 min-w-0 text-[#5C4A3A] space-y-12">

              {/* Section 1 */}
              <section id="section-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">1</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Introduction</h2>
                </div>
                <p className="leading-relaxed">
                  Welcome to Cardamom Kitchen (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). These Terms and Conditions of Purchase (&ldquo;Terms&rdquo;) govern your purchase of products or services (&ldquo;Products&rdquo;) from our website <span className="text-[#C4622D]">www.cardamomkitchen.co.za</span> (the &ldquo;Site&rdquo;). By placing an order, you agree to these Terms.
                </p>
              </section>

              {/* Section 2 */}
              <section id="section-2">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">2</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Order Acceptance</h2>
                </div>
                <p className="leading-relaxed">
                  All orders placed through our Site are subject to acceptance by us. We reserve the right to refuse or cancel any order at our sole discretion, including after an order confirmation has been sent, for reasons including but not limited to product availability, errors in product information, or issues with payment.
                </p>
              </section>

              {/* Section 3 */}
              <section id="section-3">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">3</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Pricing and Payment</h2>
                </div>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">3.1 Pricing</h3>
                <p className="leading-relaxed mb-5">
                  All prices listed on our Site are in South African Rand and are subject to change without notice. The total price of your order will include applicable taxes and Delivery fees, which will be calculated at checkout.
                </p>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">3.2 Payment</h3>
                <p className="leading-relaxed">
                  Payment must be made at the time of purchase. We use PayPal and Stripe as payment gateways. You agree to provide accurate and complete payment information and authorise us to charge the total amount of your order to your chosen payment method.
                </p>
              </section>

              {/* Section 4 */}
              <section id="section-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">4</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Shipping and Delivery</h2>
                </div>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">4.1 Shipping</h3>
                <p className="leading-relaxed mb-5">
                  We do not offer shipping options on our Site. Refer to our Delivery option below.
                </p>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">4.2 Delivery</h3>
                <p className="leading-relaxed">
                  Delivery times are estimates and may vary. We are not liable for any delays or damages incurred during delivery. Upon receipt of your order, you should inspect the Products and report any issues or discrepancies immediately.
                </p>
              </section>

              {/* Section 5 */}
              <section id="section-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">5</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Returns and Refunds</h2>
                </div>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">5.1 Return Policy</h3>
                <p className="leading-relaxed mb-5">
                  You may return Products within [30] minutes of receipt, provided they are in their original condition and packaging. Certain Products may be exempt from returns due to health, safety, or hygiene reasons.
                </p>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">5.2 Refunds</h3>
                <p className="leading-relaxed mb-5">
                  Refunds will be issued to the original payment method after we receive and inspect the returned Products. Delivery fees are non-refundable unless the return is due to a mistake on our part.
                </p>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">5.3 Exchanges</h3>
                <p className="leading-relaxed">
                  Exchanges are subject to availability and may require additional Delivery fees. Please contact our customer service team for exchange requests.
                </p>
              </section>

              {/* Section 6 */}
              <section id="section-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">6</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Product Information</h2>
                </div>
                <p className="leading-relaxed">
                  We strive to ensure that all Product information on our Site is accurate and up-to-date. However, we do not warrant that Product descriptions, images, or other content is error-free or complete. If you receive a Product that differs from its description, please contact us for resolution.
                </p>
              </section>

              {/* Section 7 */}
              <section id="section-7">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">7</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Limitation of Liability</h2>
                </div>
                <p className="leading-relaxed">
                  To the fullest extent permitted by law, Cardamom Kitchen is not liable for any indirect, incidental, consequential, or punitive damages arising out of or related to your purchase of Products from our Site. Our liability is limited to the total amount paid for the Products.
                </p>
              </section>

              {/* Section 8 */}
              <section id="section-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">8</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Intellectual Property</h2>
                </div>
                <p className="leading-relaxed">
                  All content on our Site, including text, graphics, logos, and images, is the property of Cardamom Kitchen or its licensors and is protected by intellectual property laws. You may not reproduce, distribute, or use any content from our Site without our prior written consent.
                </p>
              </section>

              {/* Section 9 */}
              <section id="section-9">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">9</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Governing Law</h2>
                </div>
                <p className="leading-relaxed">
                  These Terms are governed by and construed in accordance with the laws of South Africa, without regard to its conflict of law principles. Any disputes arising under these Terms will be resolved in the courts located in Cape Town.
                </p>
              </section>

              {/* Section 10 */}
              <section id="section-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">10</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Changes to Terms</h2>
                </div>
                <p className="leading-relaxed">
                  We reserve the right to modify these Terms at any time. Changes will be posted on our Site, and your continued use of our Site or purchase of Products after such changes constitutes your acceptance of the revised Terms.
                </p>
              </section>

              {/* Section 11 */}
              <section id="section-11">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">11</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Contact Us</h2>
                </div>
                <p className="leading-relaxed mb-3">
                  If you have any questions or concerns about these Terms or your purchase, please contact us at:
                </p>
                <ul className="list-none space-y-1 pl-2">
                  <li>
                    <span className="font-medium">Email: </span>
                    <a href="mailto:info@cardamomkitchen.co.za" className="text-[#C4622D] hover:underline">
                      info@cardamomkitchen.co.za
                    </a>
                  </li>
                  <li>
                    <span className="font-medium">Phone: </span>
                    <a href="tel:+27872652262" className="text-[#C4622D] hover:underline">
                      +27 87 265 2262
                    </a>
                  </li>
                  <li>
                    <span className="font-medium">Address: </span>
                    14 Sergeant St, Rondebosch East, Cape Town
                  </li>
                </ul>
              </section>

              {/* Closing */}
              <div className="border-t border-[#C8BFB5] pt-8">
                <p className="leading-relaxed text-[#8C8278]">
                  Thank you for choosing Cardamom Kitchen. We appreciate your business!
                </p>
              </div>

              {/* Back link */}
              <div>
                <Link href="/homepage" className="text-sm text-[#C4622D] hover:underline">
                  ← Back to Home
                </Link>
              </div>

            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
