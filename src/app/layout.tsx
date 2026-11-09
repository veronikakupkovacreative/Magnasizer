import type { Metadata } from "next";
import { PreferencesProvider } from "@/components/preferences";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: "/magnasizer-mark.svg" },
  title: "MAGNASIZER — Smart Creative Resizing",
  description: "MAGNASIZER: a local-first multi-artboard banner editor and smart ad resizer.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PreferencesProvider>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
