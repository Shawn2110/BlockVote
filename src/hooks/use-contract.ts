"use client";

import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract } from "ethers";
import { getContractInfo } from "@/lib/contract";

export interface Election {
  id: number;
  name: string;
  startDate: number;
  endDate: number;
  countCandidates: number;
}

export interface Candidate {
  id: number;
  name: string;
  party: string;
  voteCount: number;
}

export function useContract() {
  const [contract, setContract] = useState<Contract | null>(null);
  const [account, setAccount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (typeof window === "undefined" || !window.ethereum) {
        setError("MetaMask not detected. Please install MetaMask and refresh.");
        setLoading(false);
        return;
      }

      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const addr = await signer.getAddress();
        setAccount(addr);

        const { abi, address } = getContractInfo();
        if (!address) {
          setError("No deployed contract found. Run truffle migrate and restart.");
          setLoading(false);
          return;
        }

        const instance = new Contract(address, abi, signer);
        setContract(instance);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to connect to MetaMask";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const getElections = useCallback(async (): Promise<Election[]> => {
    if (!contract) return [];
    const count = Number(await contract.getCountElections());
    const promises = [];
    for (let i = 1; i <= count; i++) {
      promises.push(contract.getElection(i));
    }
    const results = await Promise.all(promises);
    return results.map((r) => ({
      id: Number(r[0]),
      name: r[1],
      startDate: Number(r[2]),
      endDate: Number(r[3]),
      countCandidates: Number(r[4]),
    }));
  }, [contract]);

  const getCandidates = useCallback(
    async (electionId: number): Promise<Candidate[]> => {
      if (!contract) return [];
      const count = Number(await contract.getCountCandidates(electionId));
      const promises = [];
      for (let i = 1; i <= count; i++) {
        promises.push(contract.getCandidate(electionId, i));
      }
      const results = await Promise.all(promises);
      return results.map((r) => ({
        id: Number(r[0]),
        name: r[1],
        party: r[2],
        voteCount: Number(r[3]),
      }));
    },
    [contract]
  );

  const createElection = useCallback(
    async (name: string) => {
      if (!contract) throw new Error("Contract not connected");
      const tx = await contract.createElection(name);
      await tx.wait();
    },
    [contract]
  );

  const addCandidate = useCallback(
    async (electionId: number, name: string, party: string) => {
      if (!contract) throw new Error("Contract not connected");
      const tx = await contract.addCandidate(electionId, name, party);
      await tx.wait();
    },
    [contract]
  );

  const setDates = useCallback(
    async (electionId: number, start: number, end: number) => {
      if (!contract) throw new Error("Contract not connected");
      const tx = await contract.setDates(electionId, start, end);
      await tx.wait();
    },
    [contract]
  );

  const vote = useCallback(
    async (electionId: number, candidateId: number) => {
      if (!contract) throw new Error("Contract not connected");
      const tx = await contract.vote(electionId, candidateId);
      await tx.wait();
    },
    [contract]
  );

  const checkVote = useCallback(
    async (electionId: number): Promise<boolean> => {
      if (!contract) return false;
      return await contract.checkVote(electionId);
    },
    [contract]
  );

  return {
    contract,
    account,
    error,
    loading,
    getElections,
    getCandidates,
    createElection,
    addCandidate,
    setDates,
    vote,
    checkVote,
  };
}
