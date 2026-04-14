"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Hexagon } from "lucide-react";

interface HeaderProps {
  variant: "login" | "voter" | "admin";
  account?: string;
}

export function Header({ variant, account }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  }

  const shortAddr = account
    ? account.slice(0, 6) + "..." + account.slice(-4)
    : "";

  return (
    <header className="sticky top-0 z-50 bg-background/85 border-b border-border/60 backdrop-blur-xl">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Hexagon className="w-7 h-7 text-primary" strokeWidth={2} />
          <span className="text-lg font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent tracking-tight">
            BlockVote
          </span>
        </div>

        {variant === "admin" && (
          <Badge variant="accent" className="gap-1.5 py-1 px-4 text-[11px] font-bold uppercase tracking-wider">
            <Shield className="w-3 h-3" />
            Admin Panel
          </Badge>
        )}

        <div className="flex items-center gap-3">
          {variant === "voter" && account && (
            <div className="flex items-center gap-2 bg-card/70 border border-border/70 rounded-full px-3.5 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400 animate-pulse" />
              <span className="text-xs text-muted-foreground font-mono tracking-wide">
                {shortAddr}
              </span>
            </div>
          )}

          {variant !== "login" && (
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-muted-foreground">
              Logout
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
