"use client";

import { useId, useState, type FormEvent } from "react";

import { Panel } from "@/components/admin/detail-ui";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import type { Product } from "@/lib/admin-api";
import { adminModulesApi, type DiscountPreview } from "@/lib/admin-modules-api";
import { errorText, formatINR, isMoney, todayIso } from "@/lib/format";

type Line = { key: number; productId: string; quantity: string; unitPrice: string };

let nextKey = 1;
const newLine = (): Line => ({ key: nextKey++, productId: "", quantity: "1", unitPrice: "" });

/**
 * Shows which discount the rules pick for some sample lines (no side effects, nothing is
 * counted). Invoices don't apply discounts yet; billing will use the same rules.
 */
export function DiscountPreviewPanel({ products }: { products: Product[] }) {
  const uid = useId();
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [asOf, setAsOf] = useState(todayIso);
  const [result, setResult] = useState<DiscountPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  function change(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bad = lines.some(
      (l) => !/^\d+$/.test(l.quantity.trim()) || Number(l.quantity) < 1 || !isMoney(l.unitPrice),
    );
    if (bad) {
      setError("Each line needs a quantity of 1 or more and a unit price with up to 2 decimals.");
      return;
    }
    setError(null);
    setChecking(true);
    try {
      setResult(
        await adminModulesApi.previewDiscount(
          lines.map((l) => ({
            product_id: l.productId || null,
            quantity: Number(l.quantity),
            unit_price: l.unitPrice.trim(),
          })),
          asOf || null,
        ),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <Panel title="Try the rules">
      <p className="text-sm text-zinc-600">
        Enter sample pre-tax lines to see which discount would apply. One discount per invoice:
        the one giving the largest reduction wins. Nothing is saved or counted. Invoices don&apos;t
        apply discounts yet.
      </p>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-[1fr_100px_140px_auto] sm:items-end"
          >
            <Field label={`Line ${index + 1} product`} htmlFor={`${uid}-p-${line.key}`}>
              <select
                id={`${uid}-p-${line.key}`}
                value={line.productId}
                onChange={(e) => change(line.key, { productId: e.target.value })}
                className={inputClass()}
              >
                <option value="">No product (free-text line)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantity" htmlFor={`${uid}-q-${line.key}`}>
              <input
                id={`${uid}-q-${line.key}`}
                inputMode="numeric"
                value={line.quantity}
                onChange={(e) => change(line.key, { quantity: e.target.value })}
                className={inputClass()}
              />
            </Field>
            <Field label="Unit price (₹)" htmlFor={`${uid}-u-${line.key}`}>
              <input
                id={`${uid}-u-${line.key}`}
                inputMode="decimal"
                value={line.unitPrice}
                placeholder="1000.00"
                onChange={(e) => change(line.key, { unitPrice: e.target.value })}
                className={inputClass()}
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              disabled={lines.length === 1}
              onClick={() => {
                setLines((current) => current.filter((l) => l.key !== line.key));
                setResult(null);
              }}
            >
              Remove
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={lines.length >= 20}
              onClick={() => setLines((current) => [...current, newLine()])}
            >
              Add line
            </Button>
            <div className="w-44">
              <Field label="On date" htmlFor={`${uid}-asof`}>
                <input
                  id={`${uid}-asof`}
                  type="date"
                  value={asOf}
                  onChange={(e) => {
                    setAsOf(e.target.value);
                    setResult(null);
                  }}
                  className={inputClass()}
                />
              </Field>
            </div>
          </div>
          <Button type="submit" loading={checking}>
            Check discount
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {result && (
        <dl
          aria-live="polite"
          className="grid gap-3 rounded-lg bg-zinc-50 p-4 text-sm sm:grid-cols-4"
        >
          <div>
            <dt className="text-zinc-500">Subtotal</dt>
            <dd className="font-semibold tabular-nums">{formatINR(result.subtotal)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Discount applied</dt>
            <dd className="font-semibold">{result.discount?.name ?? "None qualifies"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Reduction</dt>
            <dd className="font-semibold tabular-nums">−{formatINR(result.discount_amount)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">After discount, before tax</dt>
            <dd className="font-semibold tabular-nums">
              {formatINR(result.subtotal_after_discount)}
            </dd>
          </div>
        </dl>
      )}
    </Panel>
  );
}
