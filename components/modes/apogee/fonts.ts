// Apogee's type, from the inspo (inspo/krillion-space-variant/apogee.html): a stencil display face
// for big numbers and tier names, a mono for telemetry. Body text stays the site's Mulish.
// The stencil face is self-hosted (latin subset, variable 700–900, SIL OFL): Google Fonts sometimes
// serves it from `/l/font?kit=…&skey=…` URLs, which Turbopack's next/font/google can't parse.
import { IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";

export const apogeeDisplay = localFont({
  src: "./big-shoulders-stencil-latin.woff2",
  weight: "700 900",
  display: "swap",
  variable: "--font-apogee-display",
});
export const apogeeData = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-apogee-data" });

/** Put on the screen's root next to data-theme="apogee". */
export const apogeeFontVars = `${apogeeDisplay.variable} ${apogeeData.variable}`;
