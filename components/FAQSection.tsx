"use client";
import { useState } from "react";
import type { FaqItem } from "@/lib/product";

export default function FAQSection({ faq }: { faq: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!faq || faq.length === 0) return null;

  return (
    <section className="my-10">
      <h2 className="text-2xl font-bold text-gray-900 mb-5">
        Preguntas frecuentes
      </h2>
      <div className="space-y-2">
        {faq.map((item, i) => (
          <div
            key={i}
            className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm"
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full text-left px-5 py-4 font-semibold text-gray-900 flex justify-between items-center hover:bg-gray-50 transition-colors gap-4"
            >
              <span className="text-sm md:text-base">{item.pregunta}</span>
              <span className="text-green-600 font-bold text-xl flex-shrink-0">
                {open === i ? "−" : "+"}
              </span>
            </button>
            {open === i && (
              <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                {item.respuesta}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
