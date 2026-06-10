import type { MetadataRoute } from "next";
import { allSlugs, comparisonPairs, rankingCategories } from "@/lib/product";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://catalogomx.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const slugs = allSlugs();
  const pairs = comparisonPairs();
  const rankings = rankingCategories();
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
    ...pairs.map(({ pair }) => ({
      url: `${SITE_URL}/comparar/${pair}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    {
      url: `${SITE_URL}/rankings`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...rankings.map(({ slug }) => ({
      url: `${SITE_URL}/rankings/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
