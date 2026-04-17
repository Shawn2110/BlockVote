interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    selectedAddress: string | null;
    isMetaMask?: boolean;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
  };
}
