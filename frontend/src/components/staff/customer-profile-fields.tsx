"use client";

import { Field, inputClass } from "@/components/staff/ui";

export type ProfileValues = {
  full_name: string;
  company_name: string;
  phone: string;
  address: string;
};

export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;

export const EMPTY_PROFILE: ProfileValues = {
  full_name: "",
  company_name: "",
  phone: "",
  address: "",
};

// Same rule as the backend (app/schemas/profile.py).
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,31}$/;

export function profileFrom(source: {
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  address: string | null;
}): ProfileValues {
  return {
    full_name: source.full_name ?? "",
    company_name: source.company_name ?? "",
    phone: source.phone ?? "",
    address: source.address ?? "",
  };
}

export function validateProfile(values: ProfileValues, { nameRequired = false } = {}) {
  const errors: ProfileErrors = {};
  if (nameRequired && !values.full_name.trim()) errors.full_name = "Enter the customer's name.";
  if (values.full_name.trim().length > 200) errors.full_name = "Use 200 characters or fewer.";
  if (values.company_name.trim().length > 200) errors.company_name = "Use 200 characters or fewer.";
  if (values.phone.trim() && !PHONE_PATTERN.test(values.phone.trim()))
    errors.phone = "Use digits, with an optional + and spaces, e.g. +91 98765 43210.";
  if (values.address.trim().length > 1000) errors.address = "Use 1000 characters or fewer.";
  return errors;
}

/** Trimmed values; blanks become null so the backend clears the field. */
export function profilePayload(values: ProfileValues) {
  const clean = (v: string) => v.trim() || null;
  return {
    full_name: clean(values.full_name),
    company_name: clean(values.company_name),
    phone: clean(values.phone),
    address: clean(values.address),
  };
}

/** Name, company, phone and address inputs, shared by staff and the customer portal. */
export function ProfileFields({
  values,
  errors,
  onChange,
  disabled,
  nameLabel = "Full name",
}: {
  values: ProfileValues;
  errors: ProfileErrors;
  onChange: (values: ProfileValues) => void;
  disabled?: boolean;
  nameLabel?: string;
}) {
  const set = (key: keyof ProfileValues) => (value: string) =>
    onChange({ ...values, [key]: value });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={nameLabel} htmlFor="profile-name" error={errors.full_name}>
        <input
          id="profile-name"
          autoComplete="name"
          maxLength={200}
          value={values.full_name}
          disabled={disabled}
          onChange={(e) => set("full_name")(e.target.value)}
          aria-invalid={Boolean(errors.full_name)}
          className={inputClass}
        />
      </Field>
      <Field label="Company (optional)" htmlFor="profile-company" error={errors.company_name}>
        <input
          id="profile-company"
          autoComplete="organization"
          maxLength={200}
          value={values.company_name}
          disabled={disabled}
          onChange={(e) => set("company_name")(e.target.value)}
          aria-invalid={Boolean(errors.company_name)}
          className={inputClass}
        />
      </Field>
      <Field label="Phone (optional)" htmlFor="profile-phone" error={errors.phone}>
        <input
          id="profile-phone"
          type="tel"
          autoComplete="tel"
          maxLength={32}
          placeholder="+91 98765 43210"
          value={values.phone}
          disabled={disabled}
          onChange={(e) => set("phone")(e.target.value)}
          aria-invalid={Boolean(errors.phone)}
          className={inputClass}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address (optional)" htmlFor="profile-address" error={errors.address}>
          <textarea
            id="profile-address"
            rows={3}
            autoComplete="street-address"
            maxLength={1000}
            value={values.address}
            disabled={disabled}
            onChange={(e) => set("address")(e.target.value)}
            aria-invalid={Boolean(errors.address)}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}
