import VotingArtifact from "../../blockchain/build/contracts/Voting.json";

export function getContractInfo() {
  const networks = VotingArtifact.networks as Record<string, { address: string }>;
  const networkIds = Object.keys(networks);

  if (networkIds.length === 0) {
    return { abi: VotingArtifact.abi, address: null };
  }

  const latestAddress = networks[networkIds[networkIds.length - 1]].address;
  return { abi: VotingArtifact.abi, address: latestAddress };
}

export const CONTRACT_ABI = VotingArtifact.abi;
