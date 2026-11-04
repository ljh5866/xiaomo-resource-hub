import type { MetadataRoute } from "next";

const BASE = process.env.SITE_URL ?? "http://localhost:3100";
const ADMIN_PATH = (process.env.ADMIN_PATH ?? "admin").replace(/^\/+|\/+$/g, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          ...new Set([
            `/${ADMIN_PATH}`,
            "/admin",
            "/go/",
            "/api/",
            "/search",
            "/login",
            "/register",
            "/favorites",
          ]),
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
