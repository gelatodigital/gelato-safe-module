/* eslint-disable @typescript-eslint/no-explicit-any */
import { Signer } from "@ethersproject/abstract-signer";
import { expect } from "chai";
import hre = require("hardhat");
// import { buildSafeTransaction, executeTx, safeApproveHash } from "../src/utils";
const { ethers, deployments } = hre;
import { CounterTest, GelatoSafeModule, ITaskTreasuryUpgradable, TestAvatar, IOps } from "../typechain";
import { encodeTimeArgs, fastForwardTime, getTaskId, getTimeStampNow, Module, ModuleData } from "./utils";

// const SAFE_PROXY_FACTORY_ADDRESS = "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2";
// const SAFE_IMPLEMENTATION_ADDRESS = "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552";
// const SALT = ethers.BigNumber.from("42069");
const TASK_TREASURY_ADDRESS = "0x2807B4aE232b624023f87d0e237A3B1bf200Fd99";
const GELATO = "0x3caca7b48d0573d793d3b0279b5f0029180e83b6";
const GELATO_AUTOMATE = "0xB3f5503f93d5Ef84b06993a1975B9D21B962892F";
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ZERO_ADD = ethers.constants.AddressZero;
const FEE = ethers.utils.parseEther("0.1");
const INTERVAL = 7 * 60;
const CALL = 0;
const DELEGATECALL = 1;
interface Tx {
  to: string;
  data: string;
  value: number;
  operation: number;
}

describe("GelatoSafeModule tests", function () {
  this.timeout(0);

  let user: Signer;
  let userAddress: string;

  let executor: Signer;
  // let executorAddress: string;

  let counter: CounterTest;
  let gelatoSafeModule: GelatoSafeModule;
  let avatar: TestAvatar;
  let taskTreasury: ITaskTreasuryUpgradable;
  let automate: IOps;

  before(async function () {
    await deployments.fixture();

    [, user] = await ethers.getSigners();
    userAddress = await user.getAddress();

    counter = await ethers.getContract("CounterTest");
    gelatoSafeModule = await ethers.getContract("GelatoSafeModule");
    avatar = await ethers.getContract("TestAvatar", user);
    taskTreasury = await ethers.getContractAt("ITaskTreasuryUpgradable", TASK_TREASURY_ADDRESS);

    await avatar.enableModule(gelatoSafeModule.address);

    const isModuleEnabled = await avatar.isModuleEnabled(gelatoSafeModule.address);
    console.log(`Is GelatoGnosisSafe Module enabled? ${isModuleEnabled}`);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [GELATO],
    });
    executor = ethers.provider.getSigner(GELATO);

    // Deposit ETH on Gelato to pay for transactions via Safe
    const depositAmount = ethers.utils.parseEther("1");
    await user.sendTransaction({ to: avatar.address, value: depositAmount });
    await user.sendTransaction({ to: GELATO, value: depositAmount });
    await avatar.execTransaction(
      taskTreasury.address,
      depositAmount,
      taskTreasury.interface.encodeFunctionData("depositFunds", [avatar.address, ETH, depositAmount]),
      CALL
    );

    automate = await ethers.getContractAt("IOps", GELATO_AUTOMATE);
  });

  it("Whitelist Counter Example on GelatoSafeModule", async () => {
    const funcSig = counter.interface.getSighash("increaseCount(uint256)");
    const txSpec = {
      to: counter.address,
      selector: funcSig,
      hasValue: false,
      operation: CALL,
    };
    await avatar.execTransaction(
      gelatoSafeModule.address,
      0,
      gelatoSafeModule.interface.encodeFunctionData("whitelistTransaction", [[txSpec]]),
      CALL,
      { gasLimit: 1_000_000 }
    );
  });

  it("Automate counter incrementing with a single action", async () => {
    // create task
    const execData = counter.interface.encodeFunctionData("increaseCount", [100]);
    const gelatoSafeModuleData = gelatoSafeModule.interface.encodeFunctionData("execute", [
      avatar.address,
      [
        {
          to: counter.address,
          data: execData,
          value: 0,
          operation: CALL,
        },
      ],
    ]);
    const startTime = (await getTimeStampNow()) + INTERVAL;

    const modules: Module[] = [Module.TIME, Module.PROXY];
    const timeArgs = encodeTimeArgs(startTime, INTERVAL);
    const proxyArgs = "0x";
    const moduleData = { modules, args: [timeArgs, proxyArgs] };

    await avatar.execTransaction(
      automate.address,
      0,
      automate.interface.encodeFunctionData("createTask", [
        gelatoSafeModule.address,
        gelatoSafeModuleData,
        moduleData,
        ZERO_ADD,
      ]),
      CALL,
      { gasLimit: 2_000_000 }
    );

    // fast forward time
    await fastForwardTime(INTERVAL);

    await automate
      .connect(executor)
      .exec(avatar.address, gelatoSafeModule.address, gelatoSafeModuleData, moduleData, FEE, ETH, true, true, {
        gasLimit: 1_000_000,
      });
  });

  it("Whitelist Double Counter Example on GelatoSafeModule", async () => {
    const funcSig = counter.interface.getSighash("increaseCount(uint256)");
    const txSpec = {
      to: counter.address,
      selector: funcSig,
      hasValue: false,
      operation: CALL,
    };
    await avatar.execTransaction(
      gelatoSafeModule.address,
      0,
      gelatoSafeModule.interface.encodeFunctionData("whitelistTransaction", [[txSpec, txSpec]]),
      CALL,
      { gasLimit: 1_000_000 }
    );
  });

  it("Automate counter incrementing with a multiple actions", async () => {
    // create task
    const execData = counter.interface.encodeFunctionData("increaseCount", [1]);
    const gelatoSafeModuleData = gelatoSafeModule.interface.encodeFunctionData("execute", [
      avatar.address,
      [
        {
          to: counter.address,
          data: execData,
          value: 0,
          operation: CALL,
        },
        {
          to: counter.address,
          data: execData,
          value: 0,
          operation: CALL,
        },
      ],
    ]);
    const startTime = (await getTimeStampNow()) + INTERVAL;

    const modules: Module[] = [Module.TIME, Module.PROXY];
    const timeArgs = encodeTimeArgs(startTime, INTERVAL);
    const proxyArgs = "0x";
    const moduleData = { modules, args: [timeArgs, proxyArgs] };

    await avatar.execTransaction(
      automate.address,
      0,
      automate.interface.encodeFunctionData("createTask", [
        gelatoSafeModule.address,
        gelatoSafeModuleData,
        moduleData,
        ZERO_ADD,
      ]),
      CALL,
      { gasLimit: 2_000_000 }
    );

    // fast forward time
    await fastForwardTime(INTERVAL);

    await automate
      .connect(executor)
      .exec(avatar.address, gelatoSafeModule.address, gelatoSafeModuleData, moduleData, FEE, ETH, true, true, {
        gasLimit: 2_000_000,
      });

    const counterValue = await counter.count();
    expect(counterValue).eq(102);
  });
});
