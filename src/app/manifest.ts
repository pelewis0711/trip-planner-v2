import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WhereNext",
    short_name: "WhereNext",
    description: "Plan your study-abroad semester of travel",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#2e4a3b",
    icons: [
      { src: "/manifest-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/manifest-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/manifest-icon/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
