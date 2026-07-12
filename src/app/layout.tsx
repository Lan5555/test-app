import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./components/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: {
    default: "Lan's Hub",
    template: "%s | Lan's Hub",
  },
  description:
    "Lan's Hub is an interactive learning platform where you can test your knowledge with engaging quizzes, track your progress, and reinforce what you've learned.",
  keywords: [
    "Lan's Hub",
    "quiz",
    "learning",
    "education",
    "online tests",
    "practice questions",
    "knowledge assessment",
    "student",
    "exam preparation"
  ],
  authors: [{ name: "Lan's Hub" }],
  creator: "Lan's Hub",
  publisher: "Nicholas Johnson",
  applicationName: "Lan's Hub",
  metadataBase: new URL("https://test-app-sandy-one.vercel.app/"), // Replace with your actual domain
  openGraph: {
    title: "Lan's Hub",
    description:
      "Test what you've learned with interactive quizzes and improve your knowledge.",
    type: "website",
    siteName: "Lan's Hub",
    locale: "en_US",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
