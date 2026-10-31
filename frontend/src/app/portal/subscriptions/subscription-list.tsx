"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Alert,
  LoadingRow,
  PageHeader,
  Pagination,
  SubscriptionStatusBadge,
  TableShell,
} from "@/components/staff/ui";
import { formatDate, formatMoney, FREQUENCY_LABEL, todayIso } from "@/lib/format";
import { isQuotationExpired, listMySubscriptions } from "@/lib/portal-api";
import { useApiData } from "@/lib/use-api-data";

const PAGE_SIZE = 20;

export default function MySubscriptionsPage() {
  const [page, setPage] = useState(1);
  const list = useApiData(() => listMySubscriptions(page, PAGE_SIZE), [page]);
  const today = todayIso();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My subscriptions"
        description="Quotations sent to you and the subscriptions you hold. Open a quotation to review and accept it."
      />

      {list.error && <Alert>{list.error}</Alert>}
      {!list.data ? (
        !list.error && <LoadingRow />
      ) : (
        <>
          <TableShell
            isEmpty={list.data.items.length === 0}
            empty="No subscriptions yet. Quotations from Brightloop will appear here."
            head={
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3 text-right">Amount per period</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            }
          >
            {list.data.items.map((sub) => (
              <tr key={sub.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/portal/subscriptions/${sub.id}`}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    {sub.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-700">{sub.plan_name}</td>
                <td className="px-4 py-3 text-zinc-700">
                  {FREQUENCY_LABEL[sub.billing_frequency]}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-600">
                  {sub.status === "QUOTATION" ? (
                    isQuotationExpired(sub, today) ? (
                      <span className="text-red-700">
                        Expired {formatDate(sub.quotation_valid_until)}
                      </span>
                    ) : (
                      <>Valid until {formatDate(sub.quotation_valid_until)}</>
                    )
                  ) : sub.start_date ? (
                    <>
                      {formatDate(sub.start_date)} – {formatDate(sub.expiry_date)}
                      {sub.status === "ACTIVE" && sub.next_billing_date && (
                        <span className="block">Next bill {formatDate(sub.next_billing_date)}</span>
                      )}
                    </>
                  ) : (
                    "Starts when activated"
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {formatMoney(sub.total)}
                </td>
                <td className="px-4 py-3">
                  <SubscriptionStatusBadge status={sub.status} />
                </td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
