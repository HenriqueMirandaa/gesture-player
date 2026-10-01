import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const isPreview = process.env.VERCEL_ENV === "preview";
  return {
    rules: {
      userAgent: "*",
      allow: isPreview ? undefined : "/",
      disallow: ["/api/", ...(isPreview ? ["/"] : [])],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
