import type { ReactNode } from "react";

import type { NavIcon } from "./nav-config";

function I({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-full"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Outline icons for the sidebar, one family, 1.6px stroke to match 14px text. */
export const NAV_ICONS: Record<NavIcon, ReactNode> = {
  home: (
    <I>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-8.5Z" />
    </I>
  ),
  box: (
    <I>
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </I>
  ),
  layers: (
    <I>
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
    </I>
  ),
  repeat: (
    <I>
      <path d="M17 2.5 20.5 6 17 9.5" />
      <path d="M3.5 11V9.5a3.5 3.5 0 0 1 3.5-3.5h13.5" />
      <path d="M7 21.5 3.5 18 7 14.5" />
      <path d="M20.5 13v1.5a3.5 3.5 0 0 1-3.5 3.5H3.5" />
    </I>
  ),
  users: (
    <I>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.6.8 2.7 2.6 3 5.2" />
    </I>
  ),
  badge: (
    <I>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 16.5c.6-1.6 2.1-2.5 4-2.5s3.4.9 4 2.5" />
    </I>
  ),
  quote: (
    <I>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </I>
  ),
  invoice: (
    <I>
      <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2v-19Z" />
      <path d="M9 7.5h6M9 11.5h6M9 15.5h3" />
    </I>
  ),
  percent: (
    <I>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </I>
  ),
  tag: (
    <I>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.5" />
    </I>
  ),
  wallet: (
    <I>
      <rect x="3" y="5.5" width="18" height="14" rx="2.5" />
      <path d="M3 9.5h18M16 14.5h1.5" />
    </I>
  ),
  chart: (
    <I>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </I>
  ),
  gear: (
    <I>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </I>
  ),
  user: (
    <I>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
    </I>
  ),
  key: (
    <I>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l2.5 2.5M14.5 8.5 16.5 10.5" />
    </I>
  ),
};
