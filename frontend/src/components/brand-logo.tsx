type BrandLogoProps = {
  /** Use "light" on dark backgrounds. */
  tone?: "dark" | "light";
};

export function BrandLogo({ tone = "dark" }: BrandLogoProps) {
  const text = tone === "light" ? "text-white" : "text-zinc-900";
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="9" className="fill-indigo-600" />
        <path
          d="M10 16a6 6 0 0 1 10.2-4.3M22 16a6 6 0 0 1-10.2 4.3"
          fill="none"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="20.6" cy="11.4" r="1.9" fill="#fbbf24" />
        <circle cx="11.4" cy="20.6" r="1.9" fill="white" />
      </svg>
      <span className={`text-lg font-semibold tracking-tight ${text}`}>
        Brightloop <span className="font-normal opacity-80">Software</span>
      </span>
    </div>
  );
}
