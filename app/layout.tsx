import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chitra · Job Portal",
  description: "Curated risk & controls roles, updated twice daily.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
