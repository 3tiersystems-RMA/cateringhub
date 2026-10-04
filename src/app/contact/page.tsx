"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Icon from "@/components/ui/AppIcon";

const WHATSAPP_NUMBER = "27682892975"; // WhatsApp number in international format

export default function ContactPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    enquiryType: "General Enquiry",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const buildWhatsAppMessage = () => {
    const lines = [
      `*New Contact Form Message*`,
      ``,
      `*Name:* ${formData.fullName}`,
      `*Email:* ${formData.email}`,
      `*Phone:* ${formData.phone}`,
      `*Enquiry Type:* ${formData.enquiryType}`,
      ``,
      `*Message:*`,
      formData.message,
    ]
      .filter((l) => l !== null)
      .join("\n");
    return encodeURIComponent(lines);
  };

  const handleSendViaWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.message) return;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${buildWhatsAppMessage()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleChatOnWhatsApp = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}`, "_blank", "noopener,noreferrer");
  };

  const contactDetails = [
    {
      icon: "PhoneIcon" as const,
      label: "HELP LINE",
      value: "087 265 2262",
    },
    {
      icon: "EnvelopeIcon" as const,
      label: "GENERAL ENQUIRIES",
      value: "info@cardamomkitchen.co.za",
    },
    {
      icon: "EnvelopeIcon" as const,
      label: "SUPPORT REQUESTS",
      value: "admin@cardamomkitchen.co.za",
    },
    {
      icon: "MapPinIcon" as const,
      label: "HEAD OFFICE",
      value: "Western Cape, South Africa",
    },
    {
      icon: "ClockIcon" as const,
      label: "OFFICE HOURS",
      value: "Monday–Saturday, 08:00–20:00 SAST",
    },
  ];

  return (
    <>
      <Header />
      <main>
        {/* Hero Section */}
        <section className="bg-[#1A1612] py-24 px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs font-mono uppercase tracking-widest text-[#C4622D] mb-4">
              Get In Touch
            </p>
            <h1 className="font-display text-4xl md:text-6xl font-semibold text-white leading-tight mb-6">
              We&apos;re Here For You
            </h1>
            <p className="text-white/60 text-lg max-w-xl leading-relaxed">
              Whether you need support, want to place an order, or have a question — our
              friendly team responds to every message personally within 1 business day.
            </p>
          </div>
        </section>

        {/* Main Content */}
        <section className="bg-[#e9e0cf] py-20 px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Left: Contact Details */}
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-[#C4622D] mb-2 flex items-center gap-2">
                  <span className="inline-block w-6 h-px bg-[#C4622D]" />
                  Contact Details
                </p>
                <h2 className="font-display text-4xl font-semibold text-[#1A1612] mb-4 mt-2">
                  Reach Out to Us
                </h2>
                <p className="text-[#8C8278] text-base leading-relaxed mb-10 max-w-sm">
                  Whether you need support, want to place an order, or have a question —
                  our friendly team responds to every message personally.
                </p>

                <div className="space-y-5">
                  {contactDetails.map((item) => (
                    <div key={item.label} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#E8E0D4] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon name={item.icon} size={18} className="text-[#8C8278]" />
                      </div>
                      <div>
                        <p className="text-xs font-mono uppercase tracking-wider text-[#B5ADA5] mb-0.5">
                          {item.label}
                        </p>
                        <p className="text-[#1A1612] font-medium text-sm">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* WhatsApp Chat Button */}
                <button
                  onClick={handleChatOnWhatsApp}
                  className="mt-10 w-full flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold py-4 px-6 rounded-xl transition-colors text-base"
                >
                  <WhatsAppIcon />
                  Chat on WhatsApp
                </button>
              </div>

              {/* Right: Message Form */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#DDD5C8] p-8">
                <div className="flex items-center gap-3 mb-6">
                  <h3 className="font-display text-xl font-semibold text-[#1A1612]">
                    Send Us a Message
                  </h3>
                  <span className="inline-flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                    <WhatsAppIcon size={14} />
                    via WhatsApp
                  </span>
                </div>

                <form onSubmit={handleSendViaWhatsApp} className="space-y-5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-[#1A1612] mb-1.5">
                      Full Name <span className="text-[#C4622D]">*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="e.g. Nomsa Dlamini"
                      required
                      className="w-full border border-[#DDD5C8] rounded-lg px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D] bg-white transition"
                    />
                  </div>

                  {/* Email + Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1A1612] mb-1.5">
                        Email Address <span className="text-[#C4622D]">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="name@example.com"
                        required
                        className="w-full border border-[#DDD5C8] rounded-lg px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D] bg-white transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1612] mb-1.5">
                        Phone Number <span className="text-[#C4622D]">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+27 82 000 0000"
                        required
                        className="w-full border border-[#DDD5C8] rounded-lg px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D] bg-white transition"
                      />
                    </div>
                  </div>

                  {/* Enquiry Type */}
                  <div>
                    <label className="block text-sm font-medium text-[#1A1612] mb-1.5">
                      How Can We Help?
                    </label>
                    <select
                      name="enquiryType"
                      value={formData.enquiryType}
                      onChange={handleChange}
                      className="w-full border border-[#DDD5C8] rounded-lg px-4 py-3 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D] bg-white transition appearance-none"
                    >
                      <option>General Enquiry</option>
                      <option>Place an Order</option>
                      <option>Event Catering</option>
                      <option>Weekly Meal Prep</option>
                      <option>Support Request</option>
                      <option>Other</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-[#1A1612] mb-1.5">
                      Your Message <span className="text-[#C4622D]">*</span>
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      required
                      placeholder="Tell us about your order, event, or question..."
                      className="w-full border border-[#DDD5C8] rounded-lg px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D] bg-white transition resize-none"
                    />
                    <p className="text-xs text-[#B5ADA5] mt-1.5">
                      All information shared is treated with complete confidentiality.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold py-4 px-6 rounded-xl transition-colors text-base"
                  >
                    <WhatsAppIcon />
                    Send Message via WhatsApp
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={size}
      height={size}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
