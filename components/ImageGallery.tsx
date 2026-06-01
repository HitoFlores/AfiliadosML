"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageGalleryProps {
  images: string[];
  altBase: string;
}

export default function ImageGallery({ images, altBase }: ImageGalleryProps) {
  const [selected, setSelected] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm">
        <Image
          src={images[selected]}
          alt={`${altBase} - imagen ${selected + 1}`}
          fill
          className="object-contain p-4"
          priority={selected === 0}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
              i === selected
                ? "border-green-500 ring-2 ring-green-200"
                : "border-gray-200 hover:border-gray-400"
            }`}
            aria-label={`Ver imagen ${i + 1}`}
          >
            <div className="relative w-full h-full bg-white">
              <Image
                src={img}
                alt={`${altBase} thumb ${i + 1}`}
                fill
                className="object-contain p-1"
                sizes="64px"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
