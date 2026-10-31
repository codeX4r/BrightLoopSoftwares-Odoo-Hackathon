import Link from "next/link";

import { BrandMark } from "./brand-mark";
import { icons } from "./icons";

const NAV = [
  { href: "#workflow", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "Questions" },
];

export function SiteHeader() {
  return (
    <header className="relative z-20">
      <div className="flex h-[72px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Brightloop home">
          <BrandMark className="size-7" />
          <span className="text-[19px] font-medium tracking-[-0.03em] text-ink">brightloop</span>
        </Link>

        <nav aria-label="Main" className="absolute left-1/2 hidden -translate-x-1/2 gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[14px] text-ink/80 transition-colors duration-150 hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href="/login"
            className="hidden rounded-[10px] px-3 py-2 text-[14px] text-ink/80 transition-colors duration-150 hover:text-ink sm:block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="press rounded-[10px] bg-ink px-4 py-2 text-[14px] font-medium text-white hover:bg-black"
          >
            Get started
          </Link>
          <details className="relative md:hidden">
            <summary
              aria-label="Open menu"
              className="ml-1 flex size-9 cursor-pointer list-none items-center justify-center rounded-[10px] text-ink hover:bg-black/5 [&::-webkit-details-marker]:hidden"
            >
              <span className="size-5">{icons.menu}</span>
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute top-11 right-0 w-52 rounded-2xl border border-transparent bg-white p-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.18)]"
            >
              {[...NAV, { href: "/login", label: "Log in" }].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block rounded-[10px] px-3 py-2.5 text-[15px] text-ink hover:bg-stone"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
