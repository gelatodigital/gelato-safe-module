export const getAutomateAddress = (network: string): string => {
  const AUTOMATE_MAINNET = "0xB3f5503f93d5Ef84b06993a1975B9D21B962892F";

  switch (network) {
    case "hardhat":
    case "mainnet":
      return AUTOMATE_MAINNET;
    default:
      throw new Error("No automate address for network");
  }
};

export const getTreasuryAddress = (network: string): string => {
  const TREASURY_MAINNET = "0x2807B4aE232b624023f87d0e237A3B1bf200Fd99";

  switch (network) {
    case "hardhat":
    case "mainnet":
      return TREASURY_MAINNET;
    default:
      throw new Error("No treasury address for network");
  }
};
export const getGelatoAddress = (network: string): string => {
  const GELATO_MAINNET = "0x3caca7b48d0573d793d3b0279b5f0029180e83b6";

  switch (network) {
    case "hardhat":
    case "mainnet":
      return GELATO_MAINNET;
    default:
      throw new Error("No treasury address for network");
  }
};
