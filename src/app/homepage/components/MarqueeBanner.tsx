"use client";

const items = [
  "Weddings & Receptions",
  "Corporate Events",
  "Birthday Celebrations",
  "Weekly Meal Prep",
  "Holiday Feasts",
  "Intimate Dinner Parties",
  "Grad Parties",
  "Office Lunches",
];

export default function MarqueeBanner() {
  const doubled = [...items, ...items];

  return (
    <div className="border-y border-[#DDD5C8] bg-[#EDE7DA] overflow-hidden py-4">
      <div className="marquee-track">
        {doubled?.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center gap-6 mr-6">
            <span className="text-sm font-mono uppercase tracking-widest text-[#8C8278] whitespace-nowrap">
              {item}
            </span>
            <span className="text-[#C4622D] text-lg">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}