import type { MetadataRoute } from "next";
import { allSlugs } from "@/lib/product";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://catalogomx.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const slugs = allSlugs();
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...slugs.map(({ slug }) => ({
      url: `${SITE_URL}/reviews/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
