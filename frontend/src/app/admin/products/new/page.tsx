"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProductForm } from "@/components/admin/product-form";
import { buttonClass } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { adminApi } from "@/lib/admin-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function NewProductPage() {
  const router = useRouter();
  const types = useAsyncData(adminApi.listProductTypes, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">New product</h1>
          <p className="mt-1 text-sm text-zinc-600">Add variants after the product is saved.</p>
        </div>
        <Link href="/admin/products" className={buttonClass("secondary")}>
          Back to products
        </Link>
      </div>

      {types.loading && <LoadingState />}
      {types.error && <ErrorState message={types.error} onRetry={types.reload} />}
      {types.data && (
        <ProductForm
          productTypes={types.data}
          onSaved={(product) => router.replace(`/admin/products/${product.id}`)}
        />
      )}
    </div>
  );
}
