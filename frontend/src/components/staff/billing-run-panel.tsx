"use client";

import { useState } from "react";

import { Alert, Button, Card, inputClass } from "@/components/staff/ui";
import { todayIso } from "@/lib/format";
import { errorMessage, runBilling, type BillingRunResult } from "@/lib/staff-api";

/** Runs invoice generation on demand. The same job is meant to run daily on a schedule. */
export function BillingRunPanel({ onDone }: { onDone?: () => void }) {
  const [asOf, setAsOf] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BillingRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await runBilling(asOf || null));
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Generate invoices">
      <p className="text-sm text-zinc-600">
        Creates a draft invoice for every active subscription whose billing date has arrived,
        including any missed periods. Running it again never creates duplicates.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="billing-as-of" className="block text-xs font-medium text-zinc-600">
            Bill up to (optional)
          </label>
          <input
            id="billing-as-of"
            type="date"
            max={todayIso()}
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <Button onClick={run} busy={busy}>
          {busy ? "Generating…" : "Generate due invoices"}
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {error && <Alert>{error}</Alert>}
        {result && (
          <Alert tone={result.invoices_created ? "success" : "info"}>
            {result.invoices_created
              ? `Created ${result.invoices_created} invoice${result.invoices_created === 1 ? "" : "s"} for ${result.subscriptions_billed} subscription${result.subscriptions_billed === 1 ? "" : "s"}: ${result.invoice_numbers.join(", ")}.`
              : "Nothing is due. Every active subscription is billed up to date."}
          </Alert>
        )}
      </div>
    </Card>
  );
}
