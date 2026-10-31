"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ProductForm } from "@/components/admin/product-form";
import { VariantsPanel } from "@/components/admin/variants-panel";
import { Badge, ErrorState, LoadingState } from "@/components/ui/feedback";
import { buttonClass } from "@/components/ui/button";
import { adminApi, PRODUCT_STATUS_LABEL, type Product } from "@/lib/admin-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const product = useAsyncData(() => adminApi.getProduct(id), [id]);
  const types = useAsyncData(adminApi.listProductTypes, []);
  // Local copy so the header updates after a save without another request.
  const [saved, setSaved] = useState<Product | null>(null);
  const current = saved ?? product.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {current?.name ?? "Product"}
          </h1>
          {current && (
            <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
              <span>{current.product_type.name}</span>
              <Badge tone={current.status === "ACTIVE" ? "green" : "zinc"}>
                {PRODUCT_STATUS_LABEL[current.status]}
              </Badge>
            </div>
          )}
        </div>
        <Link href="/admin/products" className={buttonClass("secondary")}>
          Back to products
        </Link>
      </div>

      {(product.loading || types.loading) && !current && <LoadingState />}
      {product.error && <ErrorState message={product.error} onRetry={product.reload} />}
      {types.error && <ErrorState message={types.error} onRetry={types.reload} />}

      {current && types.data && (
        <>
          <ProductForm
            product={current}
            productTypes={types.data}
            onSaved={(updated) => setSaved(updated)}
          />
          <VariantsPanel productId={current.id} />
        </>
      )}
    </div>
  );
}
