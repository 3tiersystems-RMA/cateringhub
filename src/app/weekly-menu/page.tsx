"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WeeklyMenuPage() {
  const router = useRouter();

  useEffect(() => {
    router?.replace("/homepage");
  }, [router]);

  return null;
}
