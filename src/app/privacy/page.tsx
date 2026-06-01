'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const sections = [
  { id: 'section-1', label: 'Introduction' },
  { id: 'section-2', label: 'Information We Collect' },
  { id: 'section-3', label: 'How We Use Your Information' },
  { id: 'section-4', label: 'How We Share Your Information' },
  { id: 'section-5', label: 'Data Security' },
  { id: 'section-6', label: 'Your Rights and Choices' },
  { id: 'section-7', label: 'Third-Party Links' },
  { id: 'section-8', label: "Children\'s Privacy" },
  { id: 'section-9', label: 'Changes to this Privacy Policy' },
  { id: 'section-10', label: 'Contact Us' },
];

export default function PrivacyPolicyPage() {
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
            <h1 className="text-3xl md:text-4xl font-bold text-[#3D2B1F] mb-2">Privacy Policy</h1>
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
                      <span className={`flex-shrink-0 font-semibold w-5 text-right ${activeSection === s.id ? 'text-[#C4622D]' : 'text-[#C4622D]'}`}>
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
                  Welcome to the Cardamom Kitchen website (the &ldquo;Site&rdquo;). We value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our Site or use our services.
                </p>
              </section>

              {/* Section 2 */}
              <section id="section-2">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">2</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Information We Collect</h2>
                </div>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">2.1 Personal Information</h3>
                <p className="leading-relaxed mb-3">We may collect personal information that you voluntarily provide to us, such as:</p>
                <ul className="list-disc list-inside space-y-1 pl-2 mb-5">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Phone number</li>
                  <li>Payment information (if applicable)</li>
                  <li>Any other information you choose to provide</li>
                </ul>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">2.2 Usage Data</h3>
                <p className="leading-relaxed mb-3">We collect information about your interactions with our Site, including:</p>
                <ul className="list-disc list-inside space-y-1 pl-2 mb-5">
                  <li>IP address</li>
                  <li>Browser type and version</li>
                  <li>Pages you visit</li>
                  <li>Time and date of your visit</li>
                  <li>Time spent on each page</li>
                  <li>Other diagnostic data</li>
                </ul>

                <h3 className="text-base font-semibold text-[#3D2B1F] mb-2">2.3 Cookies and Tracking Technologies</h3>
                <p className="leading-relaxed">
                  We use cookies and similar tracking technologies to enhance your experience on our Site. Cookies are small files placed on your device that help us understand your preferences and improve our services. You can manage your cookie preferences through your browser settings.
                </p>
              </section>

              {/* Section 3 */}
              <section id="section-3">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">3</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">How We Use Your Information</h2>
                </div>
                <p className="leading-relaxed mb-3">We use the information we collect for various purposes, including:</p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>To provide and maintain our services</li>
                  <li>To improve and personalise your experience</li>
                  <li>To process transactions and send related information</li>
                  <li>To communicate with you, including sending updates and promotional materials (with your consent)</li>
                  <li>To analyse usage and trends to enhance our Site</li>
                  <li>To comply with legal obligations and protect our rights</li>
                </ul>
              </section>

              {/* Section 4 */}
              <section id="section-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">4</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">How We Share Your Information</h2>
                </div>
                <p className="leading-relaxed mb-3">We may share your information in the following situations:</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                  <li><span className="font-medium">With Service Providers:</span> We may share your information with third-party vendors who assist us in operating our Site and providing our services.</li>
                  <li><span className="font-medium">For Legal Reasons:</span> We may disclose your information if required by law or in response to legal processes.</li>
                  <li><span className="font-medium">Business Transfers:</span> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction.</li>
                  <li><span className="font-medium">With Your Consent:</span> We may share your information for any other purpose with your explicit consent.</li>
                </ul>
              </section>

              {/* Section 5 */}
              <section id="section-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">5</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Data Security</h2>
                </div>
                <p className="leading-relaxed">
                  We implement reasonable security measures to protect your information from unauthorised access, use, or disclosure. However, no method of transmission over the Internet or electronic storage is completely secure, so we cannot guarantee absolute security.
                </p>
              </section>

              {/* Section 6 */}
              <section id="section-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">6</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Your Rights and Choices</h2>
                </div>
                <p className="leading-relaxed mb-3">You have certain rights regarding your personal information, including:</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                  <li><span className="font-medium">Access:</span> You can request access to the personal information we hold about you.</li>
                  <li><span className="font-medium">Correction:</span> You can request correction of inaccurate or incomplete information.</li>
                  <li><span className="font-medium">Deletion:</span> You can request deletion of your personal information, subject to certain exceptions.</li>
                  <li><span className="font-medium">Opt-Out:</span> You can opt-out of receiving marketing communications from us by following the instructions in those communications.</li>
                </ul>
              </section>

              {/* Section 7 */}
              <section id="section-7">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">7</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Third-Party Links</h2>
                </div>
                <p className="leading-relaxed">
                  Our Site may contain links to third-party websites. We are not responsible for the privacy practices or content of those sites. We encourage you to review their privacy policies.
                </p>
              </section>

              {/* Section 8 */}
              <section id="section-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">8</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Children&apos;s Privacy</h2>
                </div>
                <p className="leading-relaxed">
                  Our Site is not intended for individuals under the age of 13. We do not knowingly collect or solicit personal information from children under 13. If we become aware that we have collected such information, we will take steps to delete it.
                </p>
              </section>

              {/* Section 9 */}
              <section id="section-9">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">9</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Changes to this Privacy Policy</h2>
                </div>
                <p className="leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new Privacy Policy on our Site with the updated effective date. Your continued use of the Site after such changes indicates your acceptance of the revised policy.
                </p>
              </section>

              {/* Section 10 */}
              <section id="section-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3D2B1F] text-white flex items-center justify-center text-sm font-bold">10</span>
                  <h2 className="text-2xl font-bold text-[#3D2B1F]">Contact Us</h2>
                </div>
                <p className="leading-relaxed mb-3">
                  If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
                </p>
                <ul className="list-none space-y-1 pl-2">
                  <li>
                    <span className="font-medium">Email: </span>
                    <a href="mailto:info@cardamomkitchen.co.za" className="text-[#C4622D] hover:underline">
                      info@cardamomkitchen.co.za
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
                  Thank you for trusting Cardamom Kitchen. We are committed to protecting your privacy and providing a safe and secure experience.
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
