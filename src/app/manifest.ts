import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Semesterly",
    short_name: "Semesterly",
    description: "Plan your study-abroad semester of travel",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/manifest-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/manifest-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/manifest-icon/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
