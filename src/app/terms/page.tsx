'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#FAF8F5]">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-16">
          {/* Page Title */}
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-[#3D2B1F] mb-2">Terms &amp; Conditions</h1>
            <p className="text-sm text-[#8C8278]">Effective Date: 1 September 2024</p>
          </div>

          <div className="prose prose-stone max-w-none text-[#5C4A3A] space-y-8">

            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">1. Introduction</h2>
              <p className="leading-relaxed">
                Welcome to Cardamom Kitchen (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). These Terms and Conditions of Purchase (&ldquo;Terms&rdquo;) govern your purchase of products or services (&ldquo;Products&rdquo;) from our website www.cardamomkitchen.co.za (the &ldquo;Site&rdquo;). By placing an order, you agree to these Terms.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">2. Order Acceptance</h2>
              <p className="leading-relaxed">
                All orders placed through our Site are subject to acceptance by us. We reserve the right to refuse or cancel any order at our sole discretion, including after an order confirmation has been sent, for reasons including but not limited to product availability, errors in product information, or issues with payment.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">3. Pricing and Payment</h2>

              <h3 className="text-base font-semibold text-[#5C4A3A] mb-2">3.1 Pricing</h3>
              <p className="leading-relaxed mb-5">
                All prices listed on our Site are in South African Rand and are subject to change without notice. The total price of your order will include applicable taxes and Delivery fees, which will be calculated at checkout.
              </p>

              <h3 className="text-base font-semibold text-[#5C4A3A] mb-2">3.2 Payment</h3>
              <p className="leading-relaxed">
                Payment must be made at the time of purchase. We use PayPal and Stripe as payment gateways. You agree to provide accurate and complete payment information and authorise us to charge the total amount of your order to your chosen payment method.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">4. Shipping and Delivery</h2>

              <h3 className="text-base font-semibold text-[#5C4A3A] mb-2">4.1 Shipping</h3>
              <p className="leading-relaxed mb-5">
                We do not offer shipping options on our Site. Refer to our Delivery option below.
              </p>

              <h3 className="text-base font-semibold text-[#5C4A3A] mb-2">4.2 Delivery</h3>
              <p className="leading-relaxed">
                Delivery times are estimates and may vary. We are not liable for any delays or damages incurred during delivery. Upon receipt of your order, you should inspect the Products and report any issues or discrepancies immediately.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">5. Returns and Refunds</h2>

              <h3 className="text-base font-semibold text-[#5C4A3A] mb-2">5.1 Return Policy</h3>
              <p className="leading-relaxed mb-5">
                You may return Products within [30] minutes of receipt, provided they are in their original condition and packaging. Certain Products may be exempt from returns due to health, safety, or hygiene reasons.
              </p>

              <h3 className="text-base font-semibold text-[#5C4A3A] mb-2">5.2 Refunds</h3>
              <p className="leading-relaxed mb-5">
                Refunds will be issued to the original payment method after we receive and inspect the returned Products. Delivery fees are non-refundable unless the return is due to a mistake on our part.
              </p>

              <h3 className="text-base font-semibold text-[#5C4A3A] mb-2">5.3 Exchanges</h3>
              <p className="leading-relaxed">
                Exchanges are subject to availability and may require additional Delivery fees. Please contact our customer service team for exchange requests.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">6. Product Information</h2>
              <p className="leading-relaxed">
                We strive to ensure that all Product information on our Site is accurate and up-to-date. However, we do not warrant that Product descriptions, images, or other content is error-free or complete. If you receive a Product that differs from its description, please contact us for resolution.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">7. Limitation of Liability</h2>
              <p className="leading-relaxed">
                To the fullest extent permitted by law, Cardamom Kitchen is not liable for any indirect, incidental, consequential, or punitive damages arising out of or related to your purchase of Products from our Site. Our liability is limited to the total amount paid for the Products.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">8. Intellectual Property</h2>
              <p className="leading-relaxed">
                All content on our Site, including text, graphics, logos, and images, is the property of Cardamom Kitchen or its licensors and is protected by intellectual property laws. You may not reproduce, distribute, or use any content from our Site without our prior written consent.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">9. Governing Law</h2>
              <p className="leading-relaxed">
                These Terms are governed by and construed in accordance with the laws of South Africa, without regard to its conflict of law principles. Any disputes arising under these Terms will be resolved in the courts located in Cape Town.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">10. Changes to Terms</h2>
              <p className="leading-relaxed">
                We reserve the right to modify these Terms at any time. Changes will be posted on our Site, and your continued use of our Site or purchase of Products after such changes constitutes your acceptance of the revised Terms.
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-xl font-semibold text-[#3D2B1F] mb-3">11. Contact Us</h2>
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
            <div className="border-t border-[#DDD5C8] pt-8 mt-8">
              <p className="leading-relaxed text-[#8C8278]">
                Thank you for choosing Cardamom Kitchen. We appreciate your business!
              </p>
            </div>

          </div>

          {/* Back link */}
          <div className="mt-12">
            <Link href="/homepage" className="text-sm text-[#C4622D] hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
