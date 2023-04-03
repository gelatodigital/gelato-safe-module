/* eslint-disable @typescript-eslint/no-explicit-any */
import { Signer } from "@ethersproject/abstract-signer";
import { expect } from "chai";
import hre = require("hardhat");
import { getAutomateAddress, getGelatoAddress, getTreasuryAddress } from "../hardhat/config/addresses";
const { ethers, deployments } = hre;
import {
  SafeAutoTopUpHandler,
  SafeAutoTopUp,
  GelatoSafeModule,
  ITaskTreasuryUpgradable,
  TestAvatar,
  IOps,
} from "../typechain";
import { encodeResolverArgs, Module } from "./utils";

const TASK_TREASURY_ADDRESS = getTreasuryAddress("hardhat");
const GELATO_ADDRESS = getGelatoAddress("hardhat");
const AUTOMATE_ADDRESS = getAutomateAddress("hardhat");
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const FEE = ethers.utils.parseEther("0.1");
const CALL = 0;
const DELEGATECALL = 1;

describe("SafeAutoTopUp tests", function () {
  this.timeout(0);

  let deployer: Signer;
  let user: Signer;
  let receiver1: Signer;
  let receiver2: Signer;

  let userAddress: string;
  let receiver1Address: string;
  let receiver2Address: string;

  let executor: Signer;

  let autoTopUpHandler: SafeAutoTopUpHandler;
  let autoTopUp: SafeAutoTopUp;
  let gelatoSafeModule: GelatoSafeModule;
  let avatar: TestAvatar;
  let taskTreasury: ITaskTreasuryUpgradable;
  let automate: IOps;

  const amount1 = ethers.utils.parseEther("10");
  const amount2 = ethers.utils.parseEther("10");
  const amountTreasury = ethers.utils.parseEther("1");

  const balanceThreshold1 = ethers.utils.parseEther("7");
  const balanceThreshold2 = ethers.utils.parseEther("5");

  const treasuryDepositAmount = ethers.utils.parseEther("1");
  const balanceThresholdTreasury = ethers.utils.parseEther("1");

  before(async function () {
    await deployments.fixture();

    [deployer, user, receiver1, receiver2] = await ethers.getSigners();
    userAddress = await user.getAddress();
    receiver1Address = await receiver1.getAddress();
    receiver2Address = await receiver2.getAddress();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [GELATO_ADDRESS],
    });
    executor = ethers.provider.getSigner(GELATO_ADDRESS);

    autoTopUp = await ethers.getContract("SafeAutoTopUp");
    autoTopUpHandler = await ethers.getContract("SafeAutoTopUpHandler");
    gelatoSafeModule = await ethers.getContract("GelatoSafeModule");
    avatar = await ethers.getContract("TestAvatar", user);
    automate = await ethers.getContractAt("contracts/interfaces/IOps.sol:IOps", AUTOMATE_ADDRESS);
    taskTreasury = await ethers.getContractAt(
      "contracts/interfaces/ITaskTreasuryUpgradable.sol:ITaskTreasuryUpgradable",
      TASK_TREASURY_ADDRESS
    );

    // Enable GelatoSafeModule on safe
    await avatar.enableModule(gelatoSafeModule.address);

    const isModuleEnabled = await avatar.isModuleEnabled(gelatoSafeModule.address);
    console.log(`Is GelatoGnosisSafe Module enabled? ${isModuleEnabled}`);

    // Fund safe with ETH
    await deployer.sendTransaction({ to: avatar.address, value: ethers.utils.parseEther("100") });
  });

  it("should start auto top up", async () => {
    const data = autoTopUpHandler.interface.encodeFunctionData("startAutoTopUp", [
      treasuryDepositAmount,
      [receiver1Address, receiver2Address, taskTreasury.address],
      [amount1, amount2, amountTreasury],
      [balanceThreshold1, balanceThreshold2, balanceThresholdTreasury],
    ]);

    const safeBalBefore = await ethers.provider.getBalance(avatar.address);

    const tx = await avatar.execTransaction(autoTopUpHandler.address, treasuryDepositAmount, data, DELEGATECALL);
    const events = (await tx.wait()).events;

    const event = events.filter((event) => {
      return event.address == AUTOMATE_ADDRESS;
    })[0];

    const taskId = automate.interface.decodeEventLog("TaskCreated", event.data, event.topics).taskId;

    const safeTaskIds = await automate.getTaskIdsByUser(avatar.address);
    expect(safeTaskIds).includes(taskId);

    const safeBalAfter = await ethers.provider.getBalance(avatar.address);
    const safeTreasuryBal = await taskTreasury.totalUserTokenBalance(avatar.address, ETH);
    expect(safeBalAfter).to.be.eq(safeBalBefore.sub(treasuryDepositAmount));
    expect(safeTreasuryBal).to.be.eq(treasuryDepositAmount);

    const receiversOfSafe = await autoTopUp.getReceiversOfSafe(avatar.address);
    expect(receiversOfSafe).includes(receiver1Address);
    expect(receiversOfSafe).includes(receiver2Address);
    expect(receiversOfSafe).includes(taskTreasury.address);
  });

  it("should not top up when receiver's balance above threshold", async () => {
    const [canExec] = await autoTopUp.checker(avatar.address);

    expect(canExec).to.be.eql(false);
  });

  it("should top up when receiver1's balance below threshold", async () => {
    await receiver1.sendTransaction({
      to: userAddress,
      value: (await ethers.provider.getBalance(receiver1Address)).sub(balanceThreshold1),
    });

    const receiver1BalBefore = await ethers.provider.getBalance(receiver1Address);

    const [canExec, execData] = await autoTopUp.checker(avatar.address);
    expect(canExec).to.be.eql(true);

    const modules: Module[] = [Module.RESOLVER, Module.PROXY];
    const resolverData = autoTopUp.interface.encodeFunctionData("checker", [avatar.address]);
    const resolverArgs = encodeResolverArgs(autoTopUp.address, resolverData);
    const proxyArgs = "0x";
    const moduleData = { modules, args: [resolverArgs, proxyArgs] };

    await automate
      .connect(executor)
      .exec(avatar.address, gelatoSafeModule.address, execData, moduleData, FEE, ETH, true, true);

    const receiver1BalAfter = await ethers.provider.getBalance(receiver1Address);

    expect(receiver1BalAfter).to.be.eq(receiver1BalBefore.add(amount1));
  });

  it("should top up when receiver2's balance below threshold", async () => {
    await receiver2.sendTransaction({
      to: userAddress,
      value: (await ethers.provider.getBalance(receiver2Address)).sub(balanceThreshold2),
    });

    const receiver2BalBefore = await ethers.provider.getBalance(receiver2Address);

    const [canExec, execData] = await autoTopUp.checker(avatar.address);
    expect(canExec).to.be.eql(true);

    const modules: Module[] = [Module.RESOLVER, Module.PROXY];
    const resolverData = autoTopUp.interface.encodeFunctionData("checker", [avatar.address]);
    const resolverArgs = encodeResolverArgs(autoTopUp.address, resolverData);
    const proxyArgs = "0x";
    const moduleData = { modules, args: [resolverArgs, proxyArgs] };

    await automate
      .connect(executor)
      .exec(avatar.address, gelatoSafeModule.address, execData, moduleData, FEE, ETH, true, true);

    const receiver2BalAfter = await ethers.provider.getBalance(receiver2Address);

    expect(receiver2BalAfter).to.be.eq(receiver2BalBefore.add(amount2));
  });

  it("should top up when safe's treasury balance is below threshold", async () => {
    const [canExec, execData] = await autoTopUp.checker(avatar.address);
    expect(canExec).to.be.eql(true);

    const modules: Module[] = [Module.RESOLVER, Module.PROXY];
    const resolverData = autoTopUp.interface.encodeFunctionData("checker", [avatar.address]);
    const resolverArgs = encodeResolverArgs(autoTopUp.address, resolverData);
    const proxyArgs = "0x";
    const moduleData = { modules, args: [resolverArgs, proxyArgs] };

    const safeTreasuryBalBefore = await taskTreasury.totalUserTokenBalance(avatar.address, ETH);

    await automate
      .connect(executor)
      .exec(avatar.address, gelatoSafeModule.address, execData, moduleData, FEE, ETH, true, true);

    const safeTreasuryBalAfter = await taskTreasury.totalUserTokenBalance(avatar.address, ETH);

    expect(safeTreasuryBalAfter).to.be.eq(safeTreasuryBalBefore.add(amountTreasury).sub(FEE));
  });

  it("should stop auto top up for receiver", async () => {
    const data = autoTopUp.interface.encodeFunctionData("stopAutoTopUp", [[receiver2Address]]);
    await avatar.execTransaction(autoTopUp.address, 0, data, CALL);

    const receiversOfSafe = await autoTopUp.getReceiversOfSafe(avatar.address);
    expect(receiversOfSafe).to.not.include(receiver2Address);
  });
});
