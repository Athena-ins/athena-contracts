// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Contracts
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

interface ITokenCallReceiver {
  function onTokenTransfer(
    address from,
    uint256 amount,
    bytes calldata data
  ) external returns (bool);
}

//======== ERRORS ========//

// When the length of array of arguments are not the same
error ArgumentLengthMismatch();
// When contracts allowed to receive tokens are currently limited
error ContractNotYetAllowed();
// When EAOs are targeted by the transfer & call function
error OnlyContractsAllowed();

/**
 * @title AthenaToken (ATEN), ERC-20 token
 * @notice Inherit from the ERC20Permit, allowing to sign approve off chain
 */
contract AthenaToken is ERC20Permit, Ownable {
  //======== STORAGE ========//

  // Maps a contract address to its authorized status
  mapping(address destination => bool status) private canReceive;
  // Switch that checks if the destination status is to be checked
  bool public isLimited = true;

  //======== CONSTRUCTOR ========//

  constructor(
    address[] memory destination
  )
    ERC20("Athena Token", "ATEN")
    ERC20Permit("Athena Token")
    Ownable(msg.sender)
  {
    _mint(msg.sender, 3_000_000_000 ether);

    uint256 length = destination.length;
    bool[] memory status = new bool[](length);
    for (uint i = 0; i < length; i++) status[i] = true;

    setAuthorized(destination, status);
  }

  //======== FUNCTIONS ========//

  /**
   * @notice Burns tokens from the caller
   * @param amount amount of tokens to burn
   */
  function burn(uint256 amount) external {
    _burn(msg.sender, amount);
  }

  /**
   * @notice Checks if address is a contract
   * @param address_ address to check
   * @return true if address is a contract
   *
   * @dev This function will return false if the address is:
   * - an externally-owned account
   * - a contract in construction
   * - an address where a contract will be created
   * - an address where a contract lived, but was destroyed
   * All this is considered acceptable for the intended use cases.
   *
   */
  function _isContract(address address_) private view returns (bool) {
    uint32 size;
    assembly {
      size := extcodesize(address_)
    }
    return (size > 0);
  }

  /**
   * @notice Overrides the internal ERC20 _update function
   * @dev Adds a destination restrictions during inital phase of token launch
   */
  function _update(
    address from,
    address to,
    uint256 value
  ) internal override {
    // During limited phase only authorized contracts are allowed
    if (isLimited)
      if (_isContract(to))
        if (!canReceive[to]) revert ContractNotYetAllowed();

    // Call the original _update function
    super._update(from, to, value);
  }

  /**
   * @dev Send tokens to a contract address along with call data
   * @param to destination address for the transfer
   * @param value amount to be sent
   * @param data supplementary data to be provided to the receiving contract
   */
  function transferAndCall(
    address to,
    uint value,
    bytes calldata data
  ) public returns (bool success) {
    if (_isContract(to)) revert OnlyContractsAllowed();

    _transfer(msg.sender, to, value);

    return
      ITokenCallReceiver(to).onTokenTransfer(msg.sender, value, data);
  }

  //======== ADMIN ========//

  /**
   * @notice Sets if a contract is allowed to receive ATEN
   * @param destination contract to set authorized status
   * @param status status to set
   */
  function setAuthorized(
    address[] memory destination,
    bool[] memory status
  ) public onlyOwner {
    if (destination.length != status.length)
      revert ArgumentLengthMismatch();

    for (uint256 i = 0; i < destination.length; i++) {
      canReceive[destination[i]] = status[i];
    }
  }

  /**
   * @notice Allows all contracts and renounces ownership
   * @dev This function is irreversible
   */
  function allowAll() external onlyOwner {
    renounceOwnership();
    isLimited = false;
  }
}
