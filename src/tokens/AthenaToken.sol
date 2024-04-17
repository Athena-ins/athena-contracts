// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Contracts
import { ERC20 } from "./ERC20.sol";

//======== INTERFACES ========//

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
// Not owner of the contract
error Unauthorized();

contract AthenaToken is ERC20 {
  //======== STORAGE ========//

  // Maps a contract address to its authorized status
  mapping(address destination => bool status) private canReceive;
  // Switch that checks if the destination status is to be checked
  bool public isLimited = true;
  address public owner;

  mapping(address => uint256) public nonces;

  bytes32 public DOMAIN_SEPARATOR;
  bytes32 public constant PERMIT_TYPEHASH =
    keccak256(
      "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );
  bytes32 public constant DOMAIN_TYPEHASH =
    keccak256(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

  //======== CONSTRUCTOR ========//
  constructor(
    address[] memory destination
  ) ERC20("Athena Token", "ATEN") {
    owner = msg.sender;

    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        DOMAIN_TYPEHASH,
        keccak256(bytes(name)),
        keccak256(bytes("1")),
        block.chainid,
        address(this)
      )
    );

    _mint(msg.sender, 3_000_000_000 ether);

    uint256 length = destination.length;
    bool[] memory status = new bool[](length);
    for (uint i = 0; i < length; i++) status[i] = true;
    setAuthorized(destination, status);
  }

  //======== MODIFIERS ========//

  modifier onlyOwner() {
    if (msg.sender != owner) revert Unauthorized();
    _;
  }

  //======== FUNCTIONS ========//

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

  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal override returns (bool) {
    // During limited phase only authorized contracts are allowed
    if (isLimited)
      if (_isContract(to))
        if (!canReceive[to]) revert ContractNotYetAllowed();

    return super._transfer(from, to, amount);
  }

  /**
   * @dev Send tokens to a contract address along with call data
   * @param to destination address for the transfer
   * @param amount amount to be sent
   * @param data supplementary data to be provided to the receiving contract
   */
  function transferAndCall(
    address to,
    uint256 amount,
    bytes calldata data
  ) public returns (bool) {
    if (_isContract(to)) revert OnlyContractsAllowed();

    _transfer(msg.sender, to, amount);

    return
      ITokenCallReceiver(to).onTokenTransfer(
        msg.sender,
        amount,
        data
      );
  }

  function permit(
    address account,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    require(deadline >= block.timestamp, "EXPIRED");
    unchecked {
      bytes32 digest = keccak256(
        abi.encodePacked(
          "\x19\x01",
          DOMAIN_SEPARATOR,
          keccak256(
            abi.encode(
              PERMIT_TYPEHASH,
              account,
              spender,
              value,
              nonces[account]++,
              deadline
            )
          )
        )
      );
      address recoveredAddress = ecrecover(digest, v, r, s);
      require(
        recoveredAddress != address(0) && recoveredAddress == account,
        "INVALID_SIGNATURE"
      );
      allowance[recoveredAddress][spender] = value;
    }
    emit Approval(account, spender, value);
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
    owner = address(0);
    isLimited = false;
  }
}
