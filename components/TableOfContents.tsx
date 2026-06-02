"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/toc";

interface TableOfContentsProps {
  items: TocItem[];
}

/** TOC sticky con scroll-spy: resalta la sección activa al hacer scroll. */
export default function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <nav className="hidden lg:block sticky top-20 self-start">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
        En este análisis
      </p>
      <ul className="space-y-2 border-l border-gray-200">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block pl-4 -ml-px border-l-2 text-sm transition-colors ${
                activeId === item.id
                  ? "border-green-600 text-green-700 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
