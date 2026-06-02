import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "FM Recruitment Lab",
  description: "Private in-browser FM24 recruitment scoring from uploaded HTML exports.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
