// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

contract Enum {
    enum Operation {
        Call,
        DelegateCall
    }
}

// @note Contract mimicing the Gnosis Safe without the multisig part.
// Shout out to Zodiac
contract TestAvatar {
    address public module;

    receive() external payable {}

    function enableModule(address _module) external {
        module = _module;
    }

    function disableModule(address, address) external {
        module = address(0);
    }

    function isModuleEnabled(address _module) external view returns (bool) {
        if (module == _module) {
            return true;
        } else {
            return false;
        }
    }

    function execTransaction(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        if (operation == 1) {
            (success, ) = to.delegatecall(data);
            require(success, "delegatecall failed");
        } else {
            (success, ) = to.call{value: value}(data);
            require(success, "call failed");
        }
    }

    function execTransactionFromModule(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        require(msg.sender == module, "Not authorized");
        if (operation == 1) (success, ) = to.delegatecall(data);
        else (success, ) = to.call{value: value}(data);
    }

    function execTransactionFromModuleReturnData(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success, bytes memory returnData) {
        require(msg.sender == module, "Not authorized");
        if (operation == 1) (success, ) = to.delegatecall(data);
        else (success, returnData) = to.call{value: value}(data);
    }

    function getModulesPaginated(address, uint256 pageSize)
        external
        view
        returns (address[] memory array, address next)
    {
        // Init array with max page size
        array = new address[](pageSize);

        array[0] = module;
        next = module;
    }
}
