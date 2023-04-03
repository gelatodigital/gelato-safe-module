// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IGelatoSafeModule} from "../interfaces/IGelatoSafeModule.sol";
import {ISafe} from "../interfaces/ISafe.sol";
import {ITaskTreasuryUpgradable} from "../interfaces/ITaskTreasuryUpgradable.sol";

contract SafeAutoTopUp {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct TopUpData {
        uint256 amount;
        uint256 balanceThreshold;
    }

    address internal constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    ITaskTreasuryUpgradable public immutable taskTreasury;

    /// @dev Safe => Receiver => TopUpData hash
    mapping(address => mapping(address => bytes32)) public receiverHash;
    /// @dev Safe => Receiver => TopUpData
    mapping(address => mapping(address => TopUpData)) public receiverDetails;
    /// @dev Safe => Receivers
    mapping(address => EnumerableSet.AddressSet) internal _receiversOfSafe;

    event LogStartAutoTopUp(
        address indexed safe,
        address[] _receivers,
        uint256[] _amounts,
        uint256[] _balanceThresholds
    );

    event LogStopAutoTopUp(address indexed safe, address[] _receivers);

    constructor(ITaskTreasuryUpgradable _taskTreasury) {
        taskTreasury = _taskTreasury;
    }

    function startAutoTopUp(
        address[] calldata _receivers,
        uint256[] calldata _amounts,
        uint256[] calldata _balanceThresholds
    ) external {
        uint256 length = _receivers.length;
        require(
            length == _amounts.length && length == _balanceThresholds.length,
            "AutoTopUp: startAutoTopUp: Length mismatch"
        );

        for (uint256 i; i < length; i++) _startAutoTopUp(_receivers[i], _amounts[i], _balanceThresholds[i]);

        emit LogStartAutoTopUp(msg.sender, _receivers, _amounts, _balanceThresholds);
    }

    function stopAutoTopUp(address[] calldata _receivers) external {
        uint256 length = _receivers.length;

        for (uint256 i; i < length; i++) _stopAutoTopUp(_receivers[i]);

        emit LogStopAutoTopUp(msg.sender, _receivers);
    }

    function topUp(
        address payable _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) external payable {
        require(
            receiverHash[msg.sender][_receiver] == _getReceiverHash(_amount, _balanceThreshold),
            "AutoTopUp: topUp: Invalid receiverHash"
        );
        require(msg.value == _amount, "AutoTopUp: topUp: msg.value != amount");

        if (_receiver == address(taskTreasury)) {
            _topUpTaskTreasury(msg.sender, _amount, _balanceThreshold);
        } else {
            _topUp(_receiver, _amount, _balanceThreshold);
        }
    }

    function checker(address _safe) external view returns (bool, bytes memory) {
        address[] memory receivers = _receiversOfSafe[_safe].values();

        for (uint256 i; i < receivers.length; i++) {
            address receiver = receivers[i];
            TopUpData memory topUpData = receiverDetails[_safe][receiver];
            uint256 amount = topUpData.amount;
            uint256 balanceThreshold = topUpData.balanceThreshold;

            uint256 balance;
            if (receiver == address(taskTreasury)) balance = taskTreasury.totalUserTokenBalance(_safe, ETH);
            else balance = receiver.balance;

            if (balance < balanceThreshold) {
                if (_safe.balance < amount) return (false, bytes("AutoTopUp: checker: Insufficient funds to top up"));

                bytes memory execData = _getSafeModuleTxData(_safe, receiver, amount, balanceThreshold);

                return (true, execData);
            }
        }
        return (false, bytes("AutoTopUp: checker: No address to top up"));
    }

    function getReceiversOfSafe(address _safe) external view returns (address[] memory) {
        return _receiversOfSafe[_safe].values();
    }

    function _topUp(
        address payable _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) private {
        require(_receiver.balance <= _balanceThreshold, "AutoTopUp: _topUp: Balance not below threshold");

        (bool success, ) = _receiver.call{value: _amount}("");
        require(success, "AutoTopUp: _topUp: Failed");
    }

    function _topUpTaskTreasury(
        address _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) private {
        uint256 taskTreasuryBalance = taskTreasury.totalUserTokenBalance(_receiver, ETH);
        require(taskTreasuryBalance <= _balanceThreshold, "AutoTopUp: _topUpTaskTreasury: Balance not below threshold");

        taskTreasury.depositFunds{value: _amount}(_receiver, ETH, _amount);
    }

    function _startAutoTopUp(
        address _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) private {
        require(!_receiversOfSafe[msg.sender].contains(_receiver), "AutoTopUp: _startAutoTopUp: Receiver exists");
        require(receiverHash[msg.sender][_receiver] == bytes32(0), "AutoTopUp: _startAutoTopUp: Receiver hash exists");

        _receiversOfSafe[msg.sender].add(_receiver);
        receiverHash[msg.sender][_receiver] = _getReceiverHash(_amount, _balanceThreshold);

        receiverDetails[msg.sender][_receiver] = TopUpData({amount: _amount, balanceThreshold: _balanceThreshold});
    }

    function _stopAutoTopUp(address _receiver) private {
        require(_receiversOfSafe[msg.sender].contains(_receiver), "AutoTopUp: _stopAutoTopUp: Receiver does not exist");
        require(
            receiverHash[msg.sender][_receiver] != bytes32(0),
            "AutoTopUp: _stopAutoTopUp: Receiver hash does not exist"
        );

        _receiversOfSafe[msg.sender].remove(_receiver);
        delete receiverHash[msg.sender][_receiver];
        delete receiverDetails[msg.sender][_receiver];
    }

    function _getReceiverHash(uint256 _amount, uint256 _balanceThreshold) internal pure returns (bytes32) {
        return keccak256(abi.encode(_amount, _balanceThreshold));
    }

    function _getSafeModuleTxData(
        address _safe,
        address _receiver,
        uint256 _amount,
        uint256 _balanceThreshold
    ) private view returns (bytes memory) {
        IGelatoSafeModule.Tx[] memory txn = new IGelatoSafeModule.Tx[](1);
        txn[0] = IGelatoSafeModule.Tx(
            address(this),
            abi.encodeCall(this.topUp, (payable(_receiver), _amount, _balanceThreshold)),
            _amount,
            ISafe.Operation.Call
        );

        return abi.encodeCall(IGelatoSafeModule.execute, (_safe, txn));
    }
}
