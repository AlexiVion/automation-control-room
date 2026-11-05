import type { Metadata } from "next";
import "./globals.css";
import "./slice2.css";
import "./experience.css";
export const metadata:Metadata={
  title:"Automation Control Room · Demo",
  description:"Una consulta entra, una persona autoriza la acción y el resultado queda auditado. Demo local con datos ficticios."
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body>{children}</body></html>;
}
