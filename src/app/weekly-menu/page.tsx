"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { CartProvider, useCart } from "@/app/products/components/CartContext";
import CartSidebar from "@/app/products/components/CartSidebar";

interface WeeklyMenuItem {
  id: string;
  meal_date: string;
  day_name: string;
  meal_name: string | null;
  description: string | null;
  price: number | null;
  is_closed: boolean;
  closed_reason: string | null;
}

function getWeekBounds(date: Date): { monday: Date; friday: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { monday, friday };
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

const DAY_ABBRS = ["MON", "TUE", "WED", "THU", "FRI"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function WeeklyMenuContent() {
  const supabase = createClient();
  const { addItem, setIsOpen } = useCart();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  const { monday, friday } = getWeekBounds(today);

  const [menuItems, setMenuItems] = useState<WeeklyMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      const mondayStr = toDateStr(monday);
      const fridayStr = toDateStr(friday);

      const { data, error } = await supabase
        .from("weekly_menu")
        .select("*")
        .gte("meal_date", mondayStr)
        .lte("meal_date", fridayStr)
        .order("meal_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMenuItems(data as WeeklyMenuItem[]);
      }
      setLoading(false);
    };
    fetchMenu();
  }, []);

  // Build week days with all items grouped per day
  const weekDays: Array<{
    date: Date;
    dateStr: string;
    dayAbbr: string;
    dayFull: string;
    activeItems: WeeklyMenuItem[];
    closedEntry: WeeklyMenuItem | null;
  }> = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toDateStr(d);
    const dayItems = menuItems.filter((m) => m.meal_date === dateStr);
    const closedEntry = dayItems.find((m) => m.is_closed) || null;
    const activeItems = dayItems.filter((m) => !m.is_closed);
    weekDays.push({ date: d, dateStr, dayAbbr: DAY_ABBRS[i], dayFull: DAY_FULL[i], activeItems, closedEntry });
  }

  const handleOrder = (item: WeeklyMenuItem) => {
    if (!item.meal_name || !item.price) return;
    const mealDate = new Date(item.meal_date + "T00:00:00");
    const cartProduct = {
      id: `weekly-${item.id}`,
      name: item.meal_name,
      category: "Weekly Menu",
      price: item.price,
      unit: "per portion",
      image: "",
      imageAlt: item.meal_name,
      tags: ["weekly-menu"],
      rating: 5,
      reviews: 0,
      description: item.description || "",
      available: true,
      badge: `${item.day_name} ${mealDate.getDate()} ${mealDate.toLocaleDateString("en-ZA", { month: "short" })}`,
    };
    addItem(cartProduct, 1);
    setAddedIds((prev) => new Set(prev).add(item.id));
    setIsOpen(true);
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 2000);
  };

  const monthLabel = formatMonthYear(monday);

  return (
    <>
      <CartSidebar />
      <main className="pt-20 min-h-screen bg-[#ddd4cb]">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[#1A1612] flex items-center justify-center text-lg">
                🍽️
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-[#1A1612] tracking-tight">
                Weekly Menu
              </h1>
            </div>
            <div className="w-12 h-0.5 bg-[#C4622D] mx-auto my-3" />
            <p className="text-[#C4622D] font-semibold text-lg">{monthLabel}</p>
            <p className="text-[#8C8278] text-sm mt-1">
              All Portions Typically Feed 2 Adults · Delivery Fee Applies or Collect (Mon-Fri)
            </p>
          </div>

          {/* Menu List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-28 bg-[#EDE7DA] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {weekDays.map(({ date, dateStr, dayAbbr, dayFull, activeItems, closedEntry }) => {
                const isPast = dateStr < todayStr;
                const isToday = dateStr === todayStr;
                const isClosed = !!closedEntry;
                const dateNum = date.getDate();
                const hasItems = activeItems.length > 0;

                return (
                  <div
                    key={dateStr}
                    className={`bg-white rounded-2xl border overflow-hidden transition-opacity ${
                      isPast ? "opacity-40 border-[#EDE7DA]" : "opacity-100 border-[#DDD5C8]"
                    }`}
                  >
                    {/* Day Header */}
                    <div className={`flex items-center gap-4 px-5 py-3 border-b ${
                      isClosed ? "bg-red-50 border-red-100" : isPast ? "bg-[#F5F0E8] border-[#EDE7DA]" : "bg-[#F5F0E8] border-[#EDE7DA]"
                    }`}>
                      <div className={`flex-shrink-0 w-12 text-center`}>
                        <div className={`text-3xl font-extrabold leading-none ${isPast ? "text-[#B5ADA5]" : "text-[#C4622D]"}`}>
                          {dateNum}
                        </div>
                        <div className="text-xs font-semibold text-[#8C8278] mt-0.5 tracking-widest">
                          {dayAbbr}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#1A1612] text-sm">{dayFull}</span>
                          {isToday && (
                            <span className="text-[10px] font-bold bg-[#C4622D] text-white px-2 py-0.5 rounded-full">
                              TODAY
                            </span>
                          )}
                          {isClosed && (
                            <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                              CLOSED
                            </span>
                          )}
                        </div>
                        {isClosed && (
                          <p className="text-xs text-red-600 mt-0.5 font-medium">
                            {closedEntry?.closed_reason || "Closed for the day"}
                          </p>
                        )}
                        {!isClosed && !hasItems && (
                          <p className="text-xs text-[#B5ADA5] italic mt-0.5">Menu not yet available</p>
                        )}
                        {!isClosed && hasItems && (
                          <p className="text-xs text-[#8C8278] mt-0.5">
                            {activeItems.length} item{activeItems.length > 1 ? "s" : ""} available
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    {!isClosed && hasItems && (
                      <div className="divide-y divide-[#F5F0E8]">
                        {activeItems.map((item) => {
                          const isOrderable = !isPast && !isClosed && !!item.meal_name && !!item.price;
                          const wasAdded = addedIds.has(item.id);

                          return (
                            <div key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-base font-bold text-[#1A1612] leading-snug">
                                  {item.meal_name}
                                </h3>
                                {item.description && (
                                  <p className="text-sm text-[#5C5347] mt-0.5">{item.description}</p>
                                )}
                              </div>
                              <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                <span className="text-base font-semibold text-[#1A1612]">
                                  R{item.price?.toFixed(0)}
                                </span>
                                {isOrderable && (
                                  <button
                                    onClick={() => handleOrder(item)}
                                    disabled={wasAdded}
                                    className={`text-sm font-semibold px-4 py-1.5 rounded-full transition-all duration-200 ${
                                      wasAdded
                                        ? "bg-green-500 text-white" :"bg-[#C4622D] text-white hover:bg-[#A04E22] hover:shadow-md"
                                    }`}
                                  >
                                    {wasAdded ? "✓ Added" : "Order"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer note */}
          <div className="mt-10 pt-6 border-t border-[#DDD5C8] text-xs text-[#B5ADA5] space-y-1">
            <p>
              <strong className="text-[#8C8278]">TERMS &amp; CONDITIONS:</strong> ALL MEAL ORDERS — Payment confirms order. Delivery fee is excluded. Orders placed by 12:00 will be ready for collection the following day.
            </p>
            <p className="mt-2">
              <strong className="text-[#8C8278]">ORDERS:</strong> +27 68 289 2975 · info@cardamomkitchen.co.za · www.cardamomkitchen.co.za · @cardamomkitchensa
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

export default function WeeklyMenuPage() {
  return (
    <>
      <Header />
      <CartProvider>
        <WeeklyMenuContent />
      </CartProvider>
      <Footer />
    </>
  );
}
