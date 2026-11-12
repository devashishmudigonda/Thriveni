import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lloyds/Thriveni Survey Portal",
  description: "Share your confidential employee experience with Lloyds/Thriveni.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
