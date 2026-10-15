import type { Metadata, Viewport } from "next";
import { Young_Serif, Schibsted_Grotesk } from "next/font/google";
import RootLayoutClient from "./RootLayoutClient";
import "./globals.css";

const youngSerif = Young_Serif({
  variable: "--font-young-serif",
  weight: "400",
  subsets: ["latin"],
});

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spice Selector",
  description:
    "Explore spices on an interactive flavor map and find pairings backed by recipe data, shared aroma chemistry and culinary tradition.",
};

export const viewport: Viewport = {
  themeColor: "#24282c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${youngSerif.variable} ${schibsted.variable} h-full`}>
      <body className="h-full">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
