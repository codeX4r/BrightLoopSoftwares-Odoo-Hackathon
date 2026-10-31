import type { SVGProps } from "react";

/** Outline icons for the landing page. 24px grid, 1.5px stroke, currentColor. */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const icons = {
  box: (
    <Icon>
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </Icon>
  ),
  repeat: (
    <Icon>
      <path d="M17 2.5 20.5 6 17 9.5" />
      <path d="M3.5 11V9.5a3.5 3.5 0 0 1 3.5-3.5h13.5" />
      <path d="M7 21.5 3.5 18 7 14.5" />
      <path d="M20.5 13v1.5a3.5 3.5 0 0 1-3.5 3.5H3.5" />
    </Icon>
  ),
  quote: (
    <Icon>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Icon>
  ),
  invoice: (
    <Icon>
      <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2v-19Z" />
      <path d="M9 7.5h6M9 11.5h6M9 15.5h3" />
    </Icon>
  ),
  percent: (
    <Icon>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </Icon>
  ),
  tag: (
    <Icon>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.5" />
    </Icon>
  ),
  wallet: (
    <Icon>
      <rect x="3" y="5.5" width="18" height="14" rx="2.5" />
      <path d="M3 9.5h18M16 14.5h1.5" />
    </Icon>
  ),
  chart: (
    <Icon>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </Icon>
  ),
  rocket: (
    <Icon>
      <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2" />
      <path d="M14.5 4.5c2-2 5.5-2 5.5-2s0 3.5-2 5.5l-7 7-3.5-3.5 7-7Z" />
      <path d="M9 9H5l-2 3h5M15 15v4l-3 2v-5" />
    </Icon>
  ),
  table: (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </Icon>
  ),
  handshake: (
    <Icon>
      <path d="m8 12 3 3a1.5 1.5 0 0 0 2-2l-3-3" />
      <path d="M3 10.5 7 6.5l3 1 2-1.5h3l6 5.5-4.5 4.5" />
      <path d="M3 10.5 8.5 16l2.5 2.5a1.5 1.5 0 0 0 2-2" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M12 2.5 4 5.5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10v-6l-8-3Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Icon>
  ),
  globe: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z" />
    </Icon>
  ),
  bell: (
    <Icon>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </Icon>
  ),
  trend: (
    <Icon>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </Icon>
  ),
  copy: (
    <Icon>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Icon>
  ),
  check: (
    <Icon>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  ),
  arrowRight: (
    <Icon>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  ),
  menu: (
    <Icon>
      <path d="M4 8h16M4 16h16" />
    </Icon>
  ),
};
