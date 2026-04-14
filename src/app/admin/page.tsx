"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useContract, type Election, type Candidate } from "@/hooks/use-contract";
import {
  Plus, UserPlus, CalendarCheck, Loader2, AlertCircle, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const {
    account, error: contractError, loading: contractLoading,
    getElections, getCandidates, createElection, addCandidate, setDates,
  } = useContract();

  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // Form state
  const [electionName, setElectionName] = useState("");
  const [electionMsg, setElectionMsg] = useState({ text: "", ok: true });
  const [creating, setCreating] = useState(false);

  const [candName, setCandName] = useState("");
  const [candParty, setCandParty] = useState("");
  const [candMsg, setCandMsg] = useState({ text: "", ok: true });
  const [addingCand, setAddingCand] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateMsg, setDateMsg] = useState({ text: "", ok: true });
  const [settingDates, setSettingDates] = useState(false);

  const loadElections = useCallback(async () => {
    const data = await getElections();
    setElections(data);
    if (data.length > 0 && !selectedElection) {
      handleSelectElection(data[0]);
    }
  }, [getElections]);

  useEffect(() => {
    if (!contractLoading && !contractError) loadElections();
  }, [contractLoading, contractError, loadElections]);

  async function handleSelectElection(el: Election) {
    setSelectedElection(el);
    setCandMsg({ text: "", ok: true });
    setDateMsg({ text: "", ok: true });
    const cands = await getCandidates(el.id);
    setCandidates(cands);
  }

  async function handleCreateElection() {
    if (!electionName.trim()) {
      setElectionMsg({ text: "Please enter an election name.", ok: false });
      return;
    }
    setCreating(true);
    try {
      await createElection(electionName.trim());
      setElectionMsg({ text: "Election created successfully!", ok: true });
      setElectionName("");
      const data = await getElections();
      setElections(data);
      handleSelectElection(data[data.length - 1]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create election";
      setElectionMsg({ text: message, ok: false });
    } finally {
      setCreating(false);
    }
  }

  async function handleAddCandidate() {
    if (!selectedElection) {
      setCandMsg({ text: "Select an election first.", ok: false });
      return;
    }
    if (!candName.trim() || !candParty.trim()) {
      setCandMsg({ text: "Please fill in both fields.", ok: false });
      return;
    }
    setAddingCand(true);
    try {
      await addCandidate(selectedElection.id, candName.trim(), candParty.trim());
      setCandMsg({ text: "Candidate added successfully!", ok: true });
      setCandName("");
      setCandParty("");
      const cands = await getCandidates(selectedElection.id);
      setCandidates(cands);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add candidate";
      setCandMsg({ text: message, ok: false });
    } finally {
      setAddingCand(false);
    }
  }

  async function handleSetDates() {
    if (!selectedElection) {
      setDateMsg({ text: "Select an election first.", ok: false });
      return;
    }
    const start = Date.parse(startDate) / 1000;
    const end = Date.parse(endDate) / 1000;
    if (!start || !end) {
      setDateMsg({ text: "Please select both dates.", ok: false });
      return;
    }
    setSettingDates(true);
    try {
      await setDates(selectedElection.id, start, end);
      setDateMsg({ text: "Voting dates set successfully!", ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to set dates";
      setDateMsg({ text: message, ok: false });
    } finally {
      setSettingDates(false);
    }
  }

  if (contractLoading) {
    return (
      <>
        <Header variant="admin" account={account} />
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
        <Header variant="admin" account={account} />
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
      <Header variant="admin" account={account} />
      <main className="relative z-[1] max-w-[1100px] mx-auto px-6 py-10 pb-24">

        {/* Create Election */}
        <Card className="mb-8 border-[hsl(263,70%,58%)]/25 bg-gradient-to-br from-[hsl(263,70%,58%)]/5 to-transparent">
          <CardHeader>
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[hsl(263,70%,58%)]/15 flex items-center justify-center">
                <Plus className="w-5 h-5 text-[hsl(263,60%,75%)]" />
              </div>
              <div>
                <CardTitle>Create Election</CardTitle>
                <CardDescription>Add a new election to the blockchain — voters will see all active elections</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="electionName">Election Name</Label>
              <Input
                id="electionName"
                placeholder="e.g. Student Council Election 2026"
                value={electionName}
                onChange={(e) => setElectionName(e.target.value)}
              />
            </div>
            <Button variant="accent" onClick={handleCreateElection} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? "Creating..." : "Create Election"}
            </Button>
            {electionMsg.text && (
              <p className={cn("text-sm font-medium", electionMsg.ok ? "text-emerald-400" : "text-destructive")}>
                {electionMsg.text}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Election Tabs */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-tight">Manage Elections</h2>
          <Badge variant="default">{elections.length} election{elections.length !== 1 ? "s" : ""}</Badge>
        </div>

        {elections.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No elections yet. Create one above.</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2.5 mb-6">
              {elections.map((el) => (
                <button
                  key={el.id}
                  onClick={() => handleSelectElection(el)}
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
                {/* Managing header */}
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-card/40 border border-primary/15">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">Managing:</span>
                  <span className="text-base font-bold text-primary">{selectedElection.name}</span>
                </div>

                {/* Admin grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                  {/* Add Candidate */}
                  <Card className="hover:border-primary/20 transition-colors">
                    <CardHeader>
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                          <UserPlus className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Add Candidate</CardTitle>
                          <CardDescription>Register a new candidate to this election</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="candName">Full Name</Label>
                          <Input id="candName" placeholder="Alice Johnson" value={candName} onChange={(e) => setCandName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="candParty">Party / Alliance</Label>
                          <Input id="candParty" placeholder="Progressive Party" value={candParty} onChange={(e) => setCandParty(e.target.value)} />
                        </div>
                      </div>
                      <Button onClick={handleAddCandidate} disabled={addingCand}>
                        {addingCand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {addingCand ? "Adding..." : "Add Candidate"}
                      </Button>
                      {candMsg.text && (
                        <p className={cn("text-sm font-medium", candMsg.ok ? "text-emerald-400" : "text-destructive")}>
                          {candMsg.text}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Set Dates */}
                  <Card className="hover:border-emerald-500/20 transition-colors">
                    <CardHeader>
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <CalendarCheck className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Voting Period</CardTitle>
                          <CardDescription>Set the start and end dates for this election</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="startDate">Start Date</Label>
                          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endDate">End Date</Label>
                          <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                      </div>
                      <Button variant="success" onClick={handleSetDates} disabled={settingDates}>
                        {settingDates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {settingDates ? "Setting..." : "Set Voting Dates"}
                      </Button>
                      {dateMsg.text && (
                        <p className={cn("text-sm font-medium", dateMsg.ok ? "text-emerald-400" : "text-destructive")}>
                          {dateMsg.text}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Registered Candidates */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold tracking-tight">Registered Candidates</h2>
                  <Badge variant="default">{candidates.length} candidate{candidates.length !== 1 ? "s" : ""}</Badge>
                </div>

                {candidates.length === 0 ? (
                  <div className="text-center py-14 text-muted-foreground text-sm">
                    No candidates registered yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {candidates.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-lg hover:border-primary/20 transition-colors"
                      >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-[hsl(263,70%,58%)] flex items-center justify-center text-white text-base font-extrabold shadow-lg shadow-primary/25">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{c.name}</p>
                          <Badge variant="default" className="mt-1 text-[10px]">{c.party}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-extrabold tracking-tight">{c.voteCount}</p>
                          <p className="text-[11px] text-muted-foreground/50 font-medium">votes</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
