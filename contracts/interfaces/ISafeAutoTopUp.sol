// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

interface ISafeAutoTopUp {
    function startAutoTopUp(
        address[] calldata _receivers,
        uint256[] calldata _amounts,
        uint256[] calldata _balanceThresholds
    ) external;

    function stopAutoTopUp(address[] calldata _receivers) external;

    function topUp(
        address payable _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) external payable;

    function checker(address _safe) external view returns (bool, bytes memory);
}
