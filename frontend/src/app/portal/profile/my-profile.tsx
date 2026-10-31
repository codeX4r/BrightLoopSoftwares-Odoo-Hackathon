"use client";

import { useState } from "react";

import {
  ProfileFields,
  profileFrom,
  profilePayload,
  validateProfile,
  type ProfileErrors,
  type ProfileValues,
} from "@/components/staff/customer-profile-fields";
import { Alert, Button, Card, LoadingRow, PageHeader } from "@/components/staff/ui";
import { formatDateTime } from "@/lib/format";
import { getMyProfile, updateMyProfile, type MyProfile } from "@/lib/portal-api";
import { errorMessage } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

export default function MyProfilePage() {
  const loaded = useApiData(() => getMyProfile(), []);
  const [saved, setSaved] = useState<MyProfile | null>(null);
  const profile = saved ?? loaded.data;

  if (loaded.error && !profile) return <Alert>{loaded.error}</Alert>;
  if (!profile) return <LoadingRow />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="Your contact details appear on quotations and invoices from Brightloop."
      />
      <ProfileForm
        // Re-create the form from the latest saved values.
        key={profile.updated_at ?? "new"}
        profile={profile}
        onSaved={setSaved}
      />
    </div>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: MyProfile;
  onSaved: (profile: MyProfile) => void;
}) {
  const [values, setValues] = useState<ProfileValues>(() => profileFrom(profile));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const incomplete = !profile.full_name;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const found = validateProfile(values, { nameRequired: true });
    setErrors(found);
    setFormError(null);
    setNotice(null);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const updated = await updateMyProfile(profilePayload(values));
      onSaved(updated);
      setNotice("Profile saved.");
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {incomplete && (
        <Alert tone="info">
          Add your name and company so Brightloop staff can find you and address your quotations
          correctly.
        </Alert>
      )}
      {formError && <Alert>{formError}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      <Card title="Contact details">
        <ProfileFields values={values} errors={errors} onChange={setValues} disabled={saving} />
      </Card>
      <Card title="Sign-in">
        <p className="text-sm text-zinc-700">
          You sign in with <span className="font-medium text-zinc-900">{profile.email}</span>.
          Contact Brightloop to change it.
        </p>
      </Card>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {profile.updated_at && (
          <span className="text-xs text-zinc-500">
            Last saved {formatDateTime(profile.updated_at)}
          </span>
        )}
        <Button type="submit" busy={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
