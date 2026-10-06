import "./globals.css";
import Providers from "./components/Providers";
import AppNav from "./components/AppNav";

export const metadata = {
  title: "Student Results Portal",
  description: "Filterable, rankable student results",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('theme')!=='light')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body>
        <Providers>
          <div className="pb-16 sm:pb-0">{children}</div>
          <AppNav />
        </Providers>
      </body>
    </html>
  );
}
