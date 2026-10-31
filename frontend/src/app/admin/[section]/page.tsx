"use client";

import { useParams } from "next/navigation";

import { ADMIN_NAV } from "@/components/admin/nav";
import { EmptyState } from "@/components/ui/feedback";

/** Placeholder for admin modules whose backend is not built yet. */
export default function AdminModulePage() {
  const { section } = useParams<{ section: string }>();
  const item = ADMIN_NAV.find((nav) => nav.href === `/admin/${section}`);
  const label = item?.label ?? "This section";

  return (
    <EmptyState
      title={`${label} is not built yet`}
      description="This module is planned for a later build phase. Nothing is shown here until its backend exists, so no figures are displayed."
    />
  );
}
