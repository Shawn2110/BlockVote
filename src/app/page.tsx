"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hexagon, Loader2, Vote } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [voterId, setVoterId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!voterId.trim() || !password.trim()) {
      setError("Please enter your Voter ID and password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter_id: voterId.trim(), password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
        setLoading(false);
        return;
      }

      router.push(data.role === "admin" ? "/admin" : "/voter");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <Header variant="login" />
      <main className="relative z-[1] flex items-center justify-center min-h-[calc(100vh-64px)] px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
              <Hexagon className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-transparent mb-2">
              Welcome to BlockVote
            </h1>
            <p className="text-muted-foreground text-sm">
              Secure, transparent voting on the Ethereum blockchain
            </p>
          </div>

          <Card className="border-border/50 bg-card/40">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Vote className="w-4 h-4 text-primary" />
                Sign In
              </CardTitle>
              <CardDescription>Enter your credentials to access the voting system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="voter_id">Voter ID</Label>
                  <Input
                    id="voter_id"
                    placeholder="e.g. voter1 or admin"
                    value={voterId}
                    onChange={(e) => setVoterId(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-sm font-medium text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground/40 mt-6">
            Your vote is secured by the Ethereum blockchain
          </p>
        </div>
      </main>
    </>
  );
}
