import type { Metadata } from "next";
import "./globals.css";
import { LanguageSync } from "@/components/LanguageSync";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Login | Discipline Management System",
  description: "Login to the discipline management dashboard for behavior tracking and classroom coordination.",
  icons: {
    icon: `${basePath}/logo.png`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={`${basePath}/logo.png`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Abhaya+Libre:wght@400;500;600;700;800&display=swap" />
      </head>
      <body className="antialiased">
        <LanguageSync />
        {children}
      </body>
    </html>
  );
}
