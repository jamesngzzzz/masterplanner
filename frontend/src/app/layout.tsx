import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { PostHogProvider } from "./providers/PostHogProvider";

export const metadata: Metadata = {
  title: "Pika · Lộ trình học của con",
  description: "Lộ trình học tập thông minh và cá nhân hóa của con",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`h-full antialiased font-nunito`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[#F5F6F8]" suppressHydrationWarning>
        <PostHogProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
