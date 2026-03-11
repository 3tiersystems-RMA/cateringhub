import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from "./components/HeroSection";
import MarqueeBanner from "./components/MarqueeBanner";
import ServicesSection from "./components/ServicesSection";
import FeaturedMenu from "./components/FeaturedMenu";
import TestimonialSection from "./components/TestimonialSection";
import HowItWorksSection from "./components/HowItWorksSection";
import ContactBanner from "./components/ContactBanner";
import AuthErrorHandler from "./components/AuthErrorHandler";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} — Chef-Crafted Catering & Meal Prep`,
  description:
    "Premium catering for weddings, corporate events, and everyday occasions. Weekly meal prep delivered to your door. Locally sourced, chef-driven menus.",
  keywords: ["catering", "meal prep", "event catering", "food delivery", "chef services"],
};

export default function Homepage() {
  return (
    <>
      <AuthErrorHandler />
      <Header />
      <main>
        <HeroSection />
        <MarqueeBanner />
        <ServicesSection />
        <FeaturedMenu />
        <TestimonialSection />
        <HowItWorksSection />
        <ContactBanner />
      </main>
      <Footer />
    </>
  );
}