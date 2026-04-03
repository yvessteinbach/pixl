"use client";

import Image from "next/image";
import { LogOut, Palette, Shield, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AccountSettingsDialogProps = {
  image?: string | null;
  name?: string | null;
};

const themes = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export function AccountSettingsDialog({
  image,
  name,
}: AccountSettingsDialogProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full cursor-pointer rounded-none border border-border bg-background p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-3">
            {image ? (
              <Image
                src={image}
                alt="Avatar"
                width={36}
                height={36}
                className="rounded-xl"
              />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserRound className="size-4" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name || "Your account"}</p>
              <p className="truncate text-xs text-muted-foreground">Open account settings</p>
            </div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>
            Manage appearance and future account preferences from one place.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              {image ? (
                <Image
                  src={image}
                  alt="Avatar"
                  width={48}
                  height={48}
                  className="rounded-2xl"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserRound className="size-5" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">{name || "Unnamed user"}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline">GitHub</Badge>
                  <Badge variant="secondary">Settings ready</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-primary" />
              <p className="text-sm font-medium">Appearance</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    theme === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              <p className="text-sm font-medium">Account</p>
            </div>
            <p className="text-sm text-muted-foreground">
              This dialog is ready to grow into profile editing, team preferences, and security controls later on.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-center text-destructive hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
