# Gelato Safe Module to automate Safe transctions

## Summary

An example implementation of a Gelato Safe Module which you can use to automate transactions using a Safe proxy. This enables cool use cases such as building yield farming protocols that dont have to pool funds, but rather use funds that are under custody of the user's Safe. 

**Note:** This code is currently unaudited, please don't use this in production. If you are interested in building on top of this, feel free to reach out to us on [discord](https://discord.gg/ApbA39BKyJ). 
## How to automate transactions using your Safe

1. Whitelist which contracts and functions Gelato is allowed to execute on your Safe's behalf for extra security using the `whitelistTransaction` function on the `GelatoSafeModule.sol`
2. Deposit some network token (e.g. ETH on Ethereum) into Gelato's [TaskTreasury](https://github.com/gelatodigital/ops/blob/ea4f0dcb023861bce9ebf0840460b674cae04874/contracts/TaskTreasury/TaskTreasuryUpgradable.sol#L136) to pay for transactions
3. Call the `createTask` function on [Gelato Automate](https://github.com/gelatodigital/ops/blob/ea4f0dcb023861bce9ebf0840460b674cae04874/contracts/Ops.sol#L46) using your Safe as the `msg.sender` to tell Gelato to start automating your desired actions
4. Done! Gelato will start automating your desired actions using your Safe when the conditions you defined are met. 
## Run tests

1. `cp .env.example .env // => fill this in`
2. `yarn`
3. `yarn test`