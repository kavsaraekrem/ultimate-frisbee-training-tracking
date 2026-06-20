import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. Sitenin başlığını güncelledik ve manifest dosyamızı buraya bağladık
export const metadata: Metadata = {
  title: "Frizbi Hub",
  description: "Ultimate Frisbee Takım Takip Uygulaması",
  manifest: "/manifest.json", // 👈 Eklenen satır
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr" // 👈 Dil seçeneğini Türkçe yaptık
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}

        {/* 2. Telefonların uygulamayı arka planda kaydetmesini sağlayan akıllı script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('ServiceWorker kaydı başarılı: ', reg.scope);
                  }, function(err) {
                    console.log('ServiceWorker kaydı başarısız: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}