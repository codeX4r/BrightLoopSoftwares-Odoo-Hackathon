"use client";

import Link from "next/link";

import { Alert, ButtonLink, LoadingRow, PageHeader, TableShell } from "@/components/staff/ui";
import { formatDateTime, formatMoney, FREQUENCY_LABEL } from "@/lib/format";
import { listTemplates } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

export default function TemplatesPage() {
  const list = useApiData(() => listTemplates(), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation templates"
        description="Reusable plans, terms and lines. Pick one when creating a quotation."
        actions={<ButtonLink href="/staff/templates/new">New template</ButtonLink>}
      />
      {list.error && <Alert>{list.error}</Alert>}
      {!list.data && !list.error && <LoadingRow />}
      {list.data && (
        <TableShell
          isEmpty={list.data.length === 0}
          empty="No templates yet. Create one here, or use “Save as template” on a quotation."
          head={
            <tr>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Total per cycle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          }
        >
          {list.data.map((t) => (
            <tr key={t.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <Link
                  href={`/staff/templates/${t.id}`}
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  {t.name}
                </Link>
                {t.description && (
                  <span className="block max-w-xs truncate text-xs text-zinc-500">
                    {t.description}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-700">
                {t.plan_name}
                <span className="block text-xs text-zinc-500">
                  {FREQUENCY_LABEL[t.billing_frequency]}
                  {t.plan_id ? " · admin plan" : " · custom plan"}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-zinc-700">{t.lines.length}</td>
              <td className="px-4 py-3 text-right text-zinc-900">{formatMoney(t.total)}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                    t.is_active
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                      : "bg-zinc-100 text-zinc-500 ring-zinc-200"
                  }`}
                >
                  {t.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-600">{formatDateTime(t.updated_at)}</td>
              <td className="px-4 py-3 text-right">
                {t.is_active && (
                  <Link
                    href={`/staff/subscriptions/new?template=${t.id}`}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                  >
                    Use
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  );
}
