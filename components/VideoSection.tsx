"use client";

import { useState } from "react";
import Image from "next/image";

interface Video {
  video_id: string;
  titulo: string;
  canal: string;
  url: string;
  thumbnail: string;
  publicado: string;
}

interface VideoSectionProps {
  videos: Video[];
}

export default function VideoSection({ videos }: VideoSectionProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!videos || videos.length === 0) return null;

  return (
    <section className="my-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-5">
        Videos de reseña
      </h2>
      <div className="grid md:grid-cols-3 gap-5">
        {videos.map((video) => (
          <div key={video.video_id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {activeId === video.video_id ? (
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1`}
                  title={video.titulo}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <button
                onClick={() => setActiveId(video.video_id)}
                className="relative aspect-video w-full group"
                aria-label={`Reproducir: ${video.titulo}`}
              >
                <Image
                  src={video.thumbnail}
                  alt={video.titulo}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </button>
            )}
            <div className="p-4">
              <p className="font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">
                {video.titulo}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{video.canal.trim()}</span>
                <span>
                  {new Date(video.publicado).toLocaleDateString("es-MX", {
                    year: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
