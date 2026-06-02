import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Miracle One Recruitment Lab",
  description: "Private in-browser FM24 tactic recruitment scoring.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
