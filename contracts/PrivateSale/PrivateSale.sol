// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract PrivateSale is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  mapping(address => bool) public authTokens;

  address public immutable aten; //Mainnet 0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283;

  mapping(address => uint256) public presales;
  address[] private buyers;
  uint128 public constant ATEN_ICO_PRICE = 50;
  uint128 public constant PRICE_DIVISOR = 10000;
  uint256 public immutable maxTokensSale;
  uint256 public tokenSold = 0;
  uint256 public dateStartVesting = 0;
  mapping(address => uint256) private whitelist;

  uint8[] public distributionToken = [
    0,
    0,
    0,
    5,
    5,
    5,
    5,
    10,
    10,
    10,
    10,
    10,
    10,
    10,
    10
  ];
  mapping(uint8 => bool) private claimed;

  bool public activeSale = false;

  event Prebuy(address indexed from, uint256 amount);

  /**
   * @dev Constructs a new ICO pre-sale Contract
   * @param distributeToken The ERC20 to be distributed for ICO
   * @param maxTokens The maximum amount of ICO token to sell
   * @param tokens The authorized tokens to receive for the ICO
   */
  constructor(
    address distributeToken,
    uint256 maxTokens,
    address[] memory tokens
  ) {
    // Warning: must only allow stablecoins, no price conversion will be made
    for (uint256 i = 0; i < tokens.length; i++) {
      authTokens[tokens[i]] = true;
    }
    // For ETH price only
    aten = distributeToken;
    maxTokensSale = maxTokens;
  }

  /**
   * @dev Start sale
   * @param isActive Permits to stop sale with same function
   */
  function startSale(bool isActive) external onlyOwner {
    activeSale = isActive;
  }

  /**
   * @dev Start vesting with date from now
   */
  function startVesting() external onlyOwner {
    dateStartVesting = block.timestamp;
  }

  /**
   * @dev buy ICO tokens with selected sent token
   * @param amount Amount approved for transfer to contract to buy ICO
   * @param token Token approved for transfer to contract to buy ICO
   */
  function buy(uint256 amount, address token) public payable nonReentrant {
    require(activeSale, "Sale is not active");
    require(authTokens[token] == true, "Token not approved for this ICO");
    // Safe Transfer will revert if not successful
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    // NEEDS TO BE STABLE USD !
    // We WAD it to match 18 decimals
    amount = (amount * 10 ** 18) / (10 ** IERC20Metadata(token).decimals());
    // amount is now in USDT, in WAD
    uint256 atenSold = ((amount *
      (10 ** IERC20Metadata(aten).decimals()) *
      PRICE_DIVISOR) /
      1 ether /
      ATEN_ICO_PRICE);
    require(tokenSold + atenSold <= maxTokensSale, "Too many tokens sold");
    uint256 allowed = whitelist[msg.sender] - presales[msg.sender];
    require(atenSold <= allowed, "Not enough whitelisted tokens");
    tokenSold += atenSold;
    if (presales[msg.sender] == 0) {
      buyers.push(msg.sender);
    }
    presales[msg.sender] += atenSold;
    emit Prebuy(msg.sender, atenSold);
  }

  /**
   * @dev Whitelist wallets to allow buy
   * @param _tos Wallet to whitelist
   * @param _amounts Amount of tokens to whitelist
   */

  function whitelistAddresses(
    address[] calldata _tos,
    uint256[] calldata _amounts
  ) public onlyOwner {
    require(_tos.length == _amounts.length, "Arguments length mismatch");
    for (uint256 i = 0; i < _tos.length; i++) {
      require(_amounts[i] > 0, "Amount must be greater than 0");
      whitelist[_tos[i]] = _amounts[i];
    }
  }

  /**
   * @dev onlyOwner withdraw selected tokens from this ICO contract and unsold ATEN
   * @param tokens tokens addresses to withdraw (eth is 0xEeee...)
   * @param to wallet to receive all tokens & eth
   */
  function withdraw(address[] calldata tokens, address to) external onlyOwner {
    for (uint256 i = 0; i < tokens.length; i++) {
      if (tokens[i] == aten) {
        IERC20(aten).safeTransfer(
          to,
          IERC20(aten).balanceOf(address(this)) - tokenSold
        );
      } else {
        IERC20(tokens[i]).safeTransfer(
          to,
          IERC20(tokens[i]).balanceOf(address(this))
        );
      }
    }
    if (address(this).balance > 0) {
      to.call{ value: address(this).balance }("");
    }
  }

  /**
   * @dev Distribute tokens (from contract) with previously buy, depending on availabiliy
   * @param month Month to distribute tokens, starting from 0
   */
  function distribute(uint8 month) public nonReentrant {
    require(dateStartVesting > 0, "Vesting not active");
    require(month <= monthIndex(), "Month not available");
    require(claimed[month] == false, "Already distributed");

    for (uint256 index = 0; index < buyers.length; index++) {
      uint256 amount = (presales[buyers[index]] * distributionToken[month]) /
        100;
      if (amount > 0) {
        IERC20(aten).safeTransfer(buyers[index], amount);
      }
    }
    claimed[month] = true;
  }

  /**
   * @dev view how many claims are available now
   */
  function monthIndex() public view returns (uint8) {
    return uint8((block.timestamp - dateStartVesting) / 30 days);
  }

  /**
   * @dev view how many tokens are available now
   */
  function available(uint8 month) public view returns (uint8) {
    uint8 mi = month == 0 ? monthIndex() : month;
    return claimed[mi] ? 0 : distributionToken[mi];
  }

  /**
   * @dev change your address from previous buys
   * @param newTo new wallet address that will be able to withdraw balance
   */
  function changeAddress(address newTo) public nonReentrant {
    require(presales[msg.sender] > 0, "No tokens to change");
    uint256 amount = presales[msg.sender];
    presales[newTo] = amount;
    presales[msg.sender] = 0;
    buyers.push(newTo);
    // claimed[newTo] = claimed[msg.sender];
    emit Prebuy(newTo, amount);
  }
}
