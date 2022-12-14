// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract CounterTest {
    address public ops;
    uint256 public count;
    uint256 public lastExecuted;

    // solhint-disable not-rely-on-time
    function increaseCount(uint256 amount) external {
        // @dev commented out to test multisend
        // require(((block.timestamp - lastExecuted) > 180), "Counter: increaseCount: Time not elapsed");

        count += amount;
        lastExecuted = block.timestamp;
    }

    function checker() external view returns (bool canExec, bytes memory execPayload) {
        canExec = (block.timestamp - lastExecuted) > 180;

        execPayload = abi.encodeCall(this.increaseCount, (1));
    }
}
