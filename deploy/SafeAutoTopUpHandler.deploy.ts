import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getAutomateAddress } from "../hardhat/config/addresses";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (hre.network.name !== "hardhat") {
    console.log(`Deploying SafeAutoTopUpHandler to ${hre.network.name}. Hit ctrl + c to abort`);
  }

  const { deployments } = hre;
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();

  const automateAddress = getAutomateAddress(hre.network.name);
  const gelatoSafeModuleAddress = (await hre.ethers.getContract("GelatoSafeModule")).address;
  const safeAutoTopUpAddress = (await hre.ethers.getContract("SafeAutoTopUp")).address;

  await deploy("SafeAutoTopUpHandler", {
    from: deployer,
    args: [automateAddress, gelatoSafeModuleAddress, safeAutoTopUpAddress],
  });
};

export default func;

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  const shouldSkip = hre.network.name !== "hardhat";
  return shouldSkip;
};

func.tags = ["SafeAutoTopUpHandler"];
