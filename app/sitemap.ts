import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://servio.app";

  return [
    {

    },
    {
      url: `${baseUrl}/demo`,

    },
    {
      url: `${baseUrl}/privacy`,

    },
    {
      url: `${baseUrl}/terms`,

    },
    {
      url: `${baseUrl}/cookies`,

    },
    {
      url: `${baseUrl}/refund-policy`,

    },
  ];
}
