import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GymLog - Authentication",
  description: "Secure authentication slice for GymLog workout tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
