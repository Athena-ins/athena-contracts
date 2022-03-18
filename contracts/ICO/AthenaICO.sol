// SPDX-License-Identifier: MIT

pragma solidity ^0.8;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract AthenaICO is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    mapping(address => bool) public authTokens;

    address public immutable aten; //Mainnet 0x86cEB9FA7f5ac373d275d328B7aCA1c05CFb0283;
    address public immutable eth = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    AggregatorV3Interface internal priceFeed;

    mapping(address => uint256) public presales;

    uint128 public constant ATEN_ICO_PRICE = 350;
    uint128 public constant PRICE_DIVISOR = 10000;
    uint256 public immutable maxTokensSale;
    uint256 public tokenSold = 0;
    uint256 public nextClaim = 0;
    mapping(address => uint8) private claimed;

    bool public activeSale = false;
    bool public activeClaim = false;

    event Prebuy(address indexed from, uint256 amount);

    /**
     * @dev Constructs a new ICO pre-sale Contract
     * @param distributeToken The ERC20 to be distributed for ICO
     * @param maxTokens The maximum amount of ICO token to sell
     * @param tokens The authorized tokens to receive for the ICO
     * @param priceAggregator The chainlink Oracle Aggregator for conversion ETH to stable USD
     */
    constructor(
        address distributeToken,
        uint256 maxTokens,
        address[] memory tokens,
        address priceAggregator
    ) {
        // Warning: must only allow stablecoins, no price conversion will be made
        for (uint256 i = 0; i < tokens.length; i++) {
            authTokens[tokens[i]] = true;
        }
        // For ETH price only
        priceFeed = AggregatorV3Interface(priceAggregator);
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
     * @dev Start claim and/or set time for next Claims
     * @param isActive Boolean to start / stop claim
     * @param next Boolean to start nextClaim within next 30 days
     */
    function startClaim(bool isActive, bool next) external onlyOwner {
        activeClaim = isActive;
        if (next) {
            nextClaim =
                (nextClaim != 0 ? nextClaim : block.timestamp) +
                30 days;
        }
    }

    /**
     * @dev buy ICO tokens with selected sent token or ETH
     * @param amount Amount approved for transfer to contract to buy ICO
     * @param token Token approved for transfer to contract to buy ICO
     * @param to Selected account which will be able to claim
     */
    function prebuy(
        uint256 amount,
        address token,
        address to
    ) public payable nonReentrant {
        require(activeSale, "Sale is not yet active");
        require(authTokens[token] == true, "Not approved Token for this ICO");
        if (token != eth) {
            // Safe Transfer will revert if not successful
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            // NEEDS TO BE STABLE USD !
            // We WAD it to match 18 decimals
            amount = (amount * 10**18) / (10**IERC20Metadata(token).decimals());
        } else {
            //token == eth
            require(msg.value >= amount, "Sent ETH not met");
            require(getLatestPrice() > 0, "Wrong price for ETH");
            amount =
                (amount * 10**priceFeed.decimals()) /
                uint256(getLatestPrice());
        }
        // amount is now in USDT, in WAD
        require(
            amount >= 200 ether && amount <= 15000 ether,
            "Amount requirements not met"
        );
        uint256 atenSold = (((amount *
            (10**IERC20Metadata(aten).decimals()) *
            PRICE_DIVISOR) /
            1 ether /
            ATEN_ICO_PRICE) / 4) * 4; // /4 to be sure we will distribute 100% token
        require(tokenSold + atenSold <= maxTokensSale, "Too many tokens sold");
        tokenSold += atenSold;
        presales[to] += atenSold;
        emit Prebuy(to, atenSold);
    }

    /**
     * @dev onlyOwner distribution of ICO tokens to selected addresses
     * @param tos Addresses to receive corresponding amounts
     * @param amounts Amounts approved for transfer from owner to tos
     * @custom:warning will likely fail if more than about 200 to 300 addresses
     */
    
    function distribute(address[] calldata tos, uint256[] calldata amounts)
        external
        onlyOwner
    {
        require(tos.length == amounts.length, "Arguments mismatch");
        require(
            IERC20(aten).allowance(owner(), address(this)) > 0,
            "Not approved for distribute"
        );
        for (uint256 i = 0; i < tos.length; i++) {
            IERC20(aten).safeTransferFrom(owner(), tos[i], amounts[i]);
        }
    }

    /**
     * @dev onlyOwner withdraw selected tokens from this ICO contract
     * @param tokens tokens addresses to withdraw (eth is 0xEeee...)
     * @param to wallet to receive all tokens & eth
     */
    function withdraw(address[] calldata tokens, address to)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != eth) {
                IERC20(tokens[i]).safeTransfer(
                    to,
                    IERC20(tokens[i]).balanceOf(address(this))
                );
            } else {
                (bool success, ) = to.call{value: address(this).balance}("");
                require(success, "Failed to send ETH balance");
            }
        }
    }

    /**
     * @dev Get your ICO tokens (from sender) with previously prebuy, depending on availabiliy
     */
    function claim() public nonReentrant {
        require(activeClaim, "Claim not yet active");
        uint8 allowed = 1;
        if (nextClaim > 0 && block.timestamp >= nextClaim) {
            allowed++;
            if (block.timestamp >= nextClaim + 30 days) {
                allowed++;
                if (block.timestamp >= nextClaim + 60 days) {
                    allowed++;
                }
            }
        }
        require(claimed[msg.sender] < allowed, "Already claimed batch");
        IERC20(aten).safeTransferFrom(
            owner(),
            msg.sender,
            (presales[msg.sender] * (allowed - claimed[msg.sender])) / 4
        );
        claimed[msg.sender] = allowed;
    }

    /**
     * @dev change your address from previous buys
     * @param newTo new wallet address that will be able to withdraw balance
     */
    function changeAddress(address newTo) public nonReentrant {
        uint256 amount = presales[msg.sender];
        presales[newTo] = amount;
        presales[msg.sender] = 0;
        claimed[newTo] = claimed[msg.sender];
        emit Prebuy(newTo, amount);
    }

    /**
     * @dev returns latest Chainlink price from oracle (X/ETH)
     */
    function getLatestPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price;
    }
}
