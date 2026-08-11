import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "부부 Goal Tracker",
    short_name: "부부 Goal",
    description: "개인과 부부의 목표를 함께 기록하는 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#f7faf7",
    theme_color: "#287a46",
    icons: [
      {
        src: "/app-icon.webp",
        sizes: "any",
        type: "image/webp",
        purpose: "maskable",
      },
    ],
  };
}
