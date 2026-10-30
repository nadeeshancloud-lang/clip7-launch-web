import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Clip7 — Download videos & music", template: "%s | Clip7" },
  description: "Download video and audio from public media links. Choose your available format or get Clip Sevan 2.0.0 Beta for Android.",
  metadataBase: new URL("https://clip7-sevan.fluffyleaf15.chatgpt.site"),
  icons: {
    icon: [{ url: "/favicon.svg?v=3", type: "image/svg+xml" }],
    shortcut: "/favicon.svg?v=3",
    apple: "/assets/clip7-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
