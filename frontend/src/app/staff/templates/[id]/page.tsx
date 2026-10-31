"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { TemplateForm } from "@/components/staff/template-form";
import { Alert, Button, ButtonLink, LoadingRow, PageHeader } from "@/components/staff/ui";
import { deleteTemplate, errorMessage, getTemplate, updateTemplate } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const loaded = useApiData(() => getTemplate(id), [id]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const template = loaded.data;
  if (loaded.error && !template) return <Alert>{loaded.error}</Alert>;
  if (!template) return <LoadingRow />;

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTemplate(id);
      router.replace("/staff/templates");
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/staff/templates" className="text-sm text-indigo-600 hover:text-indigo-500">
        ← Quotation templates
      </Link>
      <PageHeader
        title={template.name}
        description="Changes apply to new quotations only. Quotations already made from it stay as they are."
        actions={
          <>
            {template.is_active && (
              <ButtonLink href={`/staff/subscriptions/new?template=${template.id}`}>
                Use for a new quotation
              </ButtonLink>
            )}
            {confirmDelete ? (
              <>
                <Button variant="danger" busy={deleting} onClick={remove}>
                  Yes, delete
                </Button>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </>
        }
      />
      {deleteError && <Alert>{deleteError}</Alert>}
      {saved && <Alert tone="success">Template saved.</Alert>}
      <TemplateForm
        key={template.updated_at}
        initial={template}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await updateTemplate(id, input);
          setSaved(true);
          loaded.reload();
        }}
      />
    </div>
  );
}
