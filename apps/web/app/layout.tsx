import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={
  title:"Automation Control Room · Demo",
  description:"Diseñá, aprobá e inspeccioná automatizaciones con evidencia real."
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body>{children}</body></html>;
}
