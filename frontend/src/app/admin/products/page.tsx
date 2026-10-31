"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useNotify } from "@/components/admin/toast-context";
import { Badge } from "@/components/ui/feedback";
import { Button, buttonClass } from "@/components/ui/button";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
} from "@/components/ui/feedback";
import { inputClass } from "@/components/ui/field";
import { adminApi, PRODUCT_STATUS_LABEL, type Product, type ProductStatus } from "@/lib/admin-api";
import { errorText, formatINR } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const PAGE_SIZE = 10;

export default function ProductsPage() {
  const notify = useNotify();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [typeId, setTypeId] = useState("");
  const [offset, setOffset] = useState(0);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  // Wait for typing to pause before querying the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const types = useAsyncData(adminApi.listProductTypes, []);
  const products = useAsyncData(
    () =>
      adminApi.listProducts({
        q,
        status: status || undefined,
        product_type_id: typeId || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    [q, status, typeId, offset],
  );

  async function toggleArchive(product: Product) {
    const next: ProductStatus = product.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    try {
      await adminApi.updateProduct(product.id, { status: next });
      notify(next === "ARCHIVED" ? "Product archived." : "Product restored.");
      products.reload();
    } catch (err) {
      notify(errorText(err), "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await adminApi.deleteProduct(toDelete.id);
      notify("Product deleted.");
      setToDelete(null);
      products.reload();
    } catch (err) {
      // The server refuses to delete products used by plans and says to archive them.
      notify(errorText(err), "error");
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  }

  const filtersActive = Boolean(q || status || typeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Products</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Sales and cost prices in INR. Each product can have variants with extra pricing.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/product-types" className={buttonClass("secondary")}>
            Product types
          </Link>
          <Link href="/admin/products/new" className={buttonClass("primary")}>
            New product
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_180px_200px]">
        <input
          aria-label="Search products"
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass()}
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | ProductStatus);
            setOffset(0);
          }}
          className={inputClass()}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          aria-label="Filter by product type"
          value={typeId}
          onChange={(e) => {
            setTypeId(e.target.value);
            setOffset(0);
          }}
          className={inputClass()}
        >
          <option value="">All types</option>
          {types.data?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      {products.loading && !products.data && <LoadingState />}
      {products.error && <ErrorState message={products.error} onRetry={products.reload} />}

      {products.data && products.data.total === 0 && (
        <EmptyState
          title={filtersActive ? "No products match these filters" : "No products yet"}
          description={
            filtersActive
              ? "Try a different search or clear the filters."
              : "Create your first product to start building plans."
          }
          action={
            !filtersActive && (
              <Link href="/admin/products/new" className={buttonClass("primary")}>
                New product
              </Link>
            )
          }
        />
      )}

      {products.data && products.data.total > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Sales price</th>
                <th className="px-4 py-3 text-right">Cost price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products.data.items.map((product) => (
                <tr key={product.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{product.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{product.product_type.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatINR(product.sales_price)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatINR(product.cost_price)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={product.status === "ACTIVE" ? "green" : "zinc"}>
                      {PRODUCT_STATUS_LABEL[product.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className={buttonClass("secondary", "sm")}
                      >
                        Edit
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => toggleArchive(product)}>
                        {product.status === "ACTIVE" ? "Archive" : "Restore"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setToDelete(product)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {products.data && (
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={products.data.total}
          onChange={setOffset}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete product?"
        message={`"${toDelete?.name ?? ""}" will be permanently removed. Products used by a plan can't be deleted; archive them instead.`}
        confirmLabel="Delete product"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
