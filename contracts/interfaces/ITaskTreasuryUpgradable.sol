// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

interface ITaskTreasuryUpgradable {
    function depositFunds(
        address receiver,
        address token,
        uint256 amount
    ) external payable;

    function withdrawFunds(
        address payable receiver,
        address token,
        uint256 amount
    ) external;

    function totalUserTokenBalance(address user, address token) external view returns (uint256);
}
