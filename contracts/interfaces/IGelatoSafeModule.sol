// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import {ISafe} from "./ISafe.sol";

interface IGelatoSafeModule {
    struct Tx {
        address to;
        bytes data;
        uint256 value;
        ISafe.Operation operation;
    }

    struct TxSpec {
        address to;
        bytes4 selector;
        bool hasValue;
        ISafe.Operation operation;
    }

    function whitelistTransaction(TxSpec[] calldata _txs) external;

    function removeTransaction(TxSpec[] calldata _txs) external;

    function execute(address _safe, Tx[] calldata _txs) external;
}
