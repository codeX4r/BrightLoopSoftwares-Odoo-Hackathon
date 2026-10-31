"use client";

import { useCompany } from "@/lib/company";

/** The seller block on printed quotations and invoices, from the admin's company settings. */
export function CompanyDetails() {
  const company = useCompany();
  return (
    <div className="mt-3 space-y-0.5 text-sm text-zinc-600">
      <p className="font-medium text-zinc-900">{company.name}</p>
      {company.address && <p className="whitespace-pre-line">{company.address}</p>}
      {company.phone && <p>{company.phone}</p>}
      {company.email && <p>{company.email}</p>}
    </div>
  );
}
