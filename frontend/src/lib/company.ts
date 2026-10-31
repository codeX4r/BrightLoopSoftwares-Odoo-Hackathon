"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";

/** Company details from the admin settings, printed on quotations and invoices. */
export type Company = {
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
};

const FALLBACK: Company = { name: "Brightloop Software", address: null, email: null, phone: null };

let cached: Promise<Company> | null = null;

/** Loads the company details once per page load; later calls reuse the same request. */
function loadCompany(): Promise<Company> {
  cached ??= apiRequest<Company>("/api/company").catch(() => {
    // Let the next screen try again instead of caching the failure.
    cached = null;
    return FALLBACK;
  });
  return cached;
}

/** The company details, or the default name while they load or if the request fails. */
export function useCompany(): Company {
  const [company, setCompany] = useState<Company>(FALLBACK);
  useEffect(() => {
    let cancelled = false;
    loadCompany().then((c) => {
      if (!cancelled) setCompany(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return company;
}
