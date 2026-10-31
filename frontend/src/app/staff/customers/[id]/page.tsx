"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  ProfileFields,
  profileFrom,
  profilePayload,
  validateProfile,
  type ProfileErrors,
} from "@/components/staff/customer-profile-fields";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  DetailList,
  InvoiceStatusBadge,
  LoadingRow,
  PageHeader,
  SubscriptionStatusBadge,
  TableShell,
} from "@/components/staff/ui";
import { formatDate, formatDateTime, formatMoney, PAYMENT_METHOD_LABEL } from "@/lib/format";
import {
  errorMessage,
  getCustomer,
  listInvoices,
  listPayments,
  listSubscriptions,
  updateCustomer,
  type StaffCustomer,
} from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const loaded = useApiData(() => getCustomer(id), [id]);
  const history = useApiData(
    () =>
      Promise.all([
        listSubscriptions({ customer_id: id }),
        listInvoices({ customer_id: id }),
        listPayments({ customer_id: id }),
      ]),
    [id],
  );
  const [override, setOverride] = useState<StaffCustomer | null>(null);
  const [editing, setEditing] = useState(false);
  const customer = override && override.id === id ? override : loaded.data;

  if (loaded.error && !customer) return <Alert>{loaded.error}</Alert>;
  if (!customer) return <LoadingRow />;

  return (
    <div className="space-y-6">
      <Link href="/staff/customers" className="text-sm text-indigo-600 hover:text-indigo-500">
        ← Customers
      </Link>
      <PageHeader
        title={customer.full_name ?? customer.company_name ?? customer.email}
        description={[customer.full_name && customer.company_name, customer.email]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {!customer.is_active && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                Deactivated
              </span>
            )}
            <ButtonLink href="/staff/subscriptions/new">New quotation</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active subscriptions" value={String(customer.active_subscriptions)} />
        <Stat label="Paid to date" value={formatMoney(customer.paid_total)} />
        <Stat label="Outstanding" value={formatMoney(customer.outstanding_amount)} />
        <Stat
          label="Overdue"
          value={formatMoney(customer.overdue_amount)}
          bad={Number(customer.overdue_amount) > 0}
        />
      </div>

      {editing ? (
        <EditCustomer
          customer={customer}
          onSaved={(updated) => {
            setOverride(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Card
          title="Contact details"
          actions={
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          }
        >
          <DetailList
            items={[
              ["Name", customer.full_name ?? "—"],
              ["Company", customer.company_name ?? "—"],
              ["Email (login)", customer.email],
              ["Phone", customer.phone ?? "—"],
              ["Address", customer.address ?? "—"],
              ["Customer since", formatDate(customer.created_at)],
              ["Open quotations", String(customer.open_quotations)],
              ["Profile last updated", formatDateTime(customer.profile_updated_at)],
            ]}
          />
        </Card>
      )}

      {history.error && <Alert>{history.error}</Alert>}
      {!history.data ? (
        !history.error && <LoadingRow />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-base font-semibold text-zinc-900">
              Quotations & subscriptions ({history.data[0].total})
            </h2>
            <TableShell
              isEmpty={history.data[0].items.length === 0}
              empty="No quotations or subscriptions yet."
              head={
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Next billing</th>
                  <th className="px-4 py-3 text-right">Total / cycle</th>
                </tr>
              }
            >
              {history.data[0].items.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/staff/subscriptions/${s.id}`}
                      className="text-indigo-600 hover:text-indigo-500"
                    >
                      {s.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{s.plan_name}</td>
                  <td className="px-4 py-3">
                    <SubscriptionStatusBadge status={s.status} />
                    {s.rejected_at && (
                      <span className="block pt-1 text-xs text-red-700">Declined</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{formatDate(s.next_billing_date)}</td>
                  <td className="px-4 py-3 text-right text-zinc-900">{formatMoney(s.total)}</td>
                </tr>
              ))}
            </TableShell>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-zinc-900">
              Invoices ({history.data[1].total})
            </h2>
            <TableShell
              isEmpty={history.data[1].items.length === 0}
              empty="No invoices yet."
              head={
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Due amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              }
            >
              {history.data[1].items.map((i) => (
                <tr key={i.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/staff/invoices/${i.id}`}
                      className="text-indigo-600 hover:text-indigo-500"
                    >
                      {i.number}
                    </Link>
                    <span className="block text-xs font-normal text-zinc-500">
                      {i.subscription.number}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{formatDate(i.due_date)}</td>
                  <td className="px-4 py-3 text-right text-zinc-900">{formatMoney(i.total)}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900">
                    {i.status === "CANCELLED" ? "—" : formatMoney(i.amount_due)}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={i.status} overdue={i.is_overdue} />
                  </td>
                </tr>
              ))}
            </TableShell>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-zinc-900">
              Payments ({history.data[2].total})
            </h2>
            <TableShell
              isEmpty={history.data[2].items.length === 0}
              empty="No payments recorded."
              head={
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Transaction ID</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              }
            >
              {history.data[2].items.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-zinc-700">{formatDate(p.paid_on)}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/staff/invoices/${p.invoice_id}`}
                      className="text-indigo-600 hover:text-indigo-500"
                    >
                      {p.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{PAYMENT_METHOD_LABEL[p.method]}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900">
                    {formatMoney(p.amount)}
                  </td>
                </tr>
              ))}
            </TableShell>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${bad ? "text-red-700" : "text-zinc-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

function EditCustomer({
  customer,
  onSaved,
  onCancel,
}: {
  customer: StaffCustomer;
  onSaved: (customer: StaffCustomer) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(() => profileFrom(customer));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const found = validateProfile(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      onSaved(await updateCustomer(customer.id, profilePayload(values)));
    } catch (err) {
      setFormError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Card title="Edit contact details">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <Alert>{formError}</Alert>}
        <ProfileFields values={values} errors={errors} onChange={setValues} disabled={saving} />
        <p className="text-xs text-zinc-500">
          The email is the customer&apos;s login and can&apos;t be changed here.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" busy={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
