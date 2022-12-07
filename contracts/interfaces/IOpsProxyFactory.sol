// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

interface IOpsProxyFactory {
    function getProxyOf(address account) external view returns (address, bool);
}
