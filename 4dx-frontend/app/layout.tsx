import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "4DX Platform",
  description: "Execution made simple.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", margin: 0, padding: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}