import type { Metadata } from 'next';
import './globals.css';
import { Plus, Cloud } from 'lucide-react';
import { auth, signIn } from '@/auth';
import Image from 'next/image';
import { Geist, Geist_Mono } from 'next/font/google';
import NavTabs from '@/components/NavTabs';
import Link from 'next/link';
import icon_white from "@/public/icon_white.svg"
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AccountSettingsDialog } from '@/components/account-settings-dialog';

export const metadata: Metadata = {
  title: 'pixl | Deploy Faster',
  description: 'A blazing fast background deployment engine.',
};

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <ThemeProvider>
          <div className="min-h-screen bg-muted/30">
            <div className="min-h-screen md:pl-[18rem]">
              <aside className="border-b border-border/60 bg-card md:fixed md:inset-y-0 md:left-0 md:z-30 md:h-screen md:w-[18rem] md:border-b-0 md:border-r">
                <div className="flex h-full flex-col gap-6 p-5">
                  <Link
                    href="/"
                    aria-label="PIXL Home"
                    className="inline-flex items-center gap-3"
                  >
                    <div className="flex size-10 items-center justify-center bg-foreground text-primary">
                      <Image priority src={icon_white} height={21} alt="PIXL" className="dark:invert" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Deploy from <br></br>Switzerland</span>
                    </div>
                  </Link>

                  {session?.user ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Navigation</p>
                      <NavTabs />
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center gap-2">
                    <div className="flex w-full flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="size-9 shrink-0">
                          <Cloud className="size-4" />
                        </Button>
                        <Button asChild className="flex-1 justify-start bg-primary text-primary-foreground hover:bg-primary/90">
                          <Link href="/">
                            <Plus className="size-4" />
                            New project
                          </Link>
                        </Button>
                      </div>

                      {session?.user ? (
                        <AccountSettingsDialog
                          image={session.user.image}
                          name={session.user.name}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </aside>

              <div className="min-w-0">
                <header className="flex items-center justify-between gap-4 border-b border-border/60 bg-background px-4 py-4 md:px-8">
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Pixl workspace
                    </p>
                    <h1 className="text-lg font-semibold tracking-tight">Control center</h1>
                  </div>

                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    {session?.user ? null : (
                      <form action={async () => {
                        "use server"
                        await signIn("github")
                      }}>
                        <Button type="submit" variant="outline">Login with GitHub</Button>
                      </form>
                    )}
                  </div>
                </header>

                <main className={cn("mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8")}>
                  {children}
                </main>
              </div>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
