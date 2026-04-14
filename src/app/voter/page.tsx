"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useContract, type Election, type Candidate } from "@/hooks/use-contract";
import { Check, Calendar, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VoterPage() {
  const {
    account, error: contractError, loading: contractLoading,
    getElections, getCandidates, vote, checkVote,
  } = useContract();

  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" as "" | "success" | "error" | "info" });
  const [voting, setVoting] = useState(false);

  const loadElections = useCallback(async () => {
    const data = await getElections();
    setElections(data);
    if (data.length > 0 && !selectedElection) {
      selectElection(data[0]);
    }
  }, [getElections, selectedElection]);

  useEffect(() => {
    if (!contractLoading && !contractError) loadElections();
  }, [contractLoading, contractError, loadElections]);

  async function selectElection(el: Election) {
    setSelectedElection(el);
    setSelectedCandidate(null);
    setMsg({ text: "", type: "" });
    const cands = await getCandidates(el.id);
    setCandidates(cands);
    const voted = await checkVote(el.id);
    setHasVoted(voted);
    if (voted) {
      setMsg({ text: "You have already voted in this election. Thank you!", type: "success" });
    }
  }

  async function handleVote() {
    if (!selectedElection || selectedCandidate === null) {
      setMsg({ text: "Please select a candidate before voting.", type: "error" });
      return;
    }
    setVoting(true);
    setMsg({ text: "Waiting for blockchain confirmation...", type: "info" });
    try {
      await vote(selectedElection.id, selectedCandidate);
      setMsg({ text: "Vote cast successfully! Thank you for participating.", type: "success" });
      setHasVoted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setMsg({ text: "Error: " + message, type: "error" });
    } finally {
      setVoting(false);
    }
  }

  function formatDate(ts: number) {
    if (ts === 0) return null;
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  if (contractLoading) {
    return (
      <>
        <Header variant="voter" account={account} />
        <main className="relative z-[1] flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>Connecting to blockchain...</p>
          </div>
        </main>
      </>
    );
  }

  if (contractError) {
    return (
      <>
        <Header variant="voter" account={account} />
        <main className="relative z-[1] flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-destructive">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-medium">{contractError}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header variant="voter" account={account} />
      <main className="relative z-[1] max-w-[960px] mx-auto px-6 py-12 pb-24">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-transparent mb-3">
            Active Elections
          </h1>
          <p className="text-muted-foreground text-sm">
            Select an election, choose your candidate, and cast your vote on the blockchain
          </p>
        </div>

        {/* Election Tabs */}
        {elections.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No elections have been created yet. Check back later.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2.5 mb-10">
              {elections.map((el) => (
                <button
                  key={el.id}
                  onClick={() => selectElection(el)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all",
                    selectedElection?.id === el.id
                      ? "bg-gradient-to-r from-primary/20 to-[hsl(263,70%,58%)]/15 border-primary/50 text-primary shadow-lg shadow-primary/10"
                      : "bg-card/50 border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30"
                  )}
                >
                  {el.name}
                </button>
              ))}
            </div>

            {selectedElection && (
              <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                {/* Election header */}
                <div className="mb-8">
                  <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mb-3">
                    {selectedElection.name}
                  </h2>
                  <Badge variant="outline" className="gap-2 py-1.5 px-4 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    {selectedElection.startDate === 0
                      ? "Voting period not set yet"
                      : `${formatDate(selectedElection.startDate)} — ${formatDate(selectedElection.endDate)}`}
                  </Badge>
                </div>

                {/* Candidates */}
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-4">
                  Select a Candidate
                </p>

                {candidates.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    No candidates registered yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                    {candidates.map((c) => (
                      <Card
                        key={c.id}
                        onClick={() => {
                          if (!hasVoted) {
                            setSelectedCandidate(c.id);
                            setMsg({ text: "", type: "" });
                          }
                        }}
                        className={cn(
                          "cursor-pointer p-5 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200",
                          selectedCandidate === c.id && "border-primary shadow-lg shadow-primary/15 bg-primary/5",
                          hasVoted && "pointer-events-none opacity-70"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-[hsl(263,70%,58%)] flex items-center justify-center text-white text-lg font-extrabold shadow-lg shadow-primary/30">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{c.name}</p>
                            <Badge variant="default" className="mt-1 text-[10px]">{c.party}</Badge>
                          </div>
                          <div
                            className={cn(
                              "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                              selectedCandidate === c.id
                                ? "border-primary bg-primary shadow-lg shadow-primary/40"
                                : "border-border/80 bg-background/50"
                            )}
                          >
                            {selectedCandidate === c.id && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Vote action */}
                <div className="flex flex-col items-center gap-4">
                  {msg.text && (
                    <p className={cn(
                      "text-sm font-medium",
                      msg.type === "success" && "text-emerald-400",
                      msg.type === "error" && "text-destructive",
                      msg.type === "info" && "text-muted-foreground"
                    )}>
                      {msg.text}
                    </p>
                  )}

                  <Button
                    size="lg"
                    className="h-13 px-10 text-base"
                    disabled={hasVoted || voting || selectedCandidate === null}
                    onClick={handleVote}
                  >
                    {voting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" strokeWidth={2.5} />
                        Cast Vote on Blockchain
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
