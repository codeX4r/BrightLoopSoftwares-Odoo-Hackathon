"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { TemplateForm } from "@/components/staff/template-form";
import { PageHeader } from "@/components/staff/ui";
import { createTemplate } from "@/lib/staff-api";

export default function NewTemplatePage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <Link href="/staff/templates" className="text-sm text-indigo-600 hover:text-indigo-500">
        ← Quotation templates
      </Link>
      <PageHeader
        title="New template"
        description="Staff can start a quotation from it and only need to pick the customer."
      />
      <TemplateForm
        submitLabel="Save template"
        onSubmit={async (input) => {
          await createTemplate(input);
          router.replace("/staff/templates");
        }}
      />
    </div>
  );
}
