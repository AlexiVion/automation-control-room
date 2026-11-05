import type { Metadata } from "next";
import "./globals.css";
import "./slice2.css";
import "@xyflow/react/dist/style.css";
export const metadata:Metadata={
  title:"Automation Control Room · Demo",
  description:"Diseñá, aprobá e inspeccioná automatizaciones con evidencia real."
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body>{children}</body></html>;
}
