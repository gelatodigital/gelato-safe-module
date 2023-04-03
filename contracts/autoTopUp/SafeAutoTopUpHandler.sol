// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import {ISafeAutoTopUp} from "../interfaces/ISafeAutoTopUp.sol";
import {IGelatoSafeModule} from "../interfaces/IGelatoSafeModule.sol";
import {ISafe} from "../interfaces/ISafe.sol";
import "../ops/OpsTaskCreator.sol";

contract SafeAutoTopUpHandler is OpsTaskCreator {
    ISafeAutoTopUp public immutable safeAutoTopUp;
    IGelatoSafeModule public immutable gelatoSafeModule;

    constructor(
        address _ops,
        IGelatoSafeModule _gelatoSafeModule,
        ISafeAutoTopUp _safeAutoTopUp
    ) OpsTaskCreator(_ops, msg.sender) {
        gelatoSafeModule = _gelatoSafeModule;
        safeAutoTopUp = _safeAutoTopUp;
    }

    function startAutoTopUp(
        uint256 _treasuryDepositAmount,
        address[] calldata _receivers,
        uint256[] calldata _amounts,
        uint256[] calldata _balanceThresholds
    ) external payable {
        _whitelistTx();

        safeAutoTopUp.startAutoTopUp(_receivers, _amounts, _balanceThresholds);

        _createOpsTask();

        _depositFunds(_treasuryDepositAmount);
    }

    function _depositFunds(uint256 _treasuryDepositAmount) private {
        taskTreasury.depositFunds{value: _treasuryDepositAmount}(address(this), ETH, _treasuryDepositAmount);
    }

    function _whitelistTx() private {
        IGelatoSafeModule.TxSpec[] memory txSpec = new IGelatoSafeModule.TxSpec[](1);
        txSpec[0] = IGelatoSafeModule.TxSpec(
            address(safeAutoTopUp),
            ISafeAutoTopUp.topUp.selector,
            true,
            ISafe.Operation.Call
        );

        gelatoSafeModule.whitelistTransaction(txSpec);
    }

    function _createOpsTask() private {
        ModuleData memory moduleData = ModuleData({modules: new Module[](2), args: new bytes[](2)});

        moduleData.modules[0] = Module.RESOLVER;
        moduleData.modules[1] = Module.PROXY;

        moduleData.args[0] = _resolverModuleArg(
            address(safeAutoTopUp),
            abi.encodeCall(ISafeAutoTopUp.checker, (address(this)))
        );

        moduleData.args[1] = _proxyModuleArg();

        _createTask(address(gelatoSafeModule), abi.encode(IGelatoSafeModule.execute.selector), moduleData, address(0));
    }
}
