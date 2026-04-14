import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chitra Job Portal",
    short_name: "Chitra Jobs",
    description: "Curated risk & controls roles, updated twice daily.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
