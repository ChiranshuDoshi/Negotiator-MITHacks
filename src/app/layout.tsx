import type { ReactNode } from "react";

export const metadata = {
  title: "PolicyScout",
  description: "PolicyScout local demo harness",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
