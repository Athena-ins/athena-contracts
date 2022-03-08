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

    uint private presaleUsers = 0;
    mapping(address => uint) public presales;
    address[] private buyers;

    uint128 public constant ATEN_ICO_PRICE = 350;
    uint128 public constant PRICE_DIVISOR = 10000;
    uint256 public immutable maxTokensSale;
    uint256 public tokenSold = 0;

    bool public activeSale = false;

    event Prebuy(address from, uint amount);

    /**
     * Network: Kovan
     * Aggregator: ETH/USD
     * Address: 0x9326BFA02ADD2366b30bacB125260Af641031331
     */

    constructor(address distributeToken, uint maxTokens, address[] memory tokens, address priceAggregator) {
        // Warning: must only allow stablecoins, no price conversion will be made
        for (uint256 i = 0; i < tokens.length; i++) {
            authTokens[tokens[i]] = true;   
        }
        // For ETH price only
        priceFeed = AggregatorV3Interface(priceAggregator);
        aten = distributeToken;
        maxTokensSale = maxTokens;
    }

    function startSale(bool isActive) external onlyOwner {
        activeSale = isActive;
    }

    function prebuy(uint amount, address token, address to) public payable {
        require(activeSale, "Sale is not yet active");
        require(authTokens[token] == true, "Not approved Token for this ICO");
        if(token == eth){
            require(msg.value >= amount, "Sent ETH not met");
        }
        // Safe Transfer will revert if not successful
        if(token != eth){
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
        if(presales[to] == 0){
            presaleUsers++;
            buyers.push(to);
        }
        if(token == eth) {
            require(getLatestPrice() > 0, "Wrong price for ETH");
            amount = amount * 10**priceFeed.decimals() / uint(getLatestPrice());
        } else {
            // We WAD it to match 18 decimals
            amount = amount * 10 ** 18 / (10**IERC20Metadata(token).decimals());
        }
        // amount is now in USDT
        require(amount > 100 * 10**18, "Min amount not met");
        uint atenSold = amount * (10 ** IERC20Metadata(aten).decimals()) / (10**18) * PRICE_DIVISOR / ATEN_ICO_PRICE;
        require(tokenSold + atenSold <= maxTokensSale, "Too many tokens sold");
        presales[to] += atenSold;
        emit Prebuy(to, amount);
    }

    // MAX 10k addresses
    function distribute(address[] calldata tos, uint[] calldata amounts) external onlyOwner {
        require(IERC20(aten).allowance(owner(), address(this)) > 0, "Not approved for distribute");
        for (uint256 i = 0; i < tos.length; i++) {
            IERC20(aten).safeTransferFrom(owner(), tos[i], amounts[i]);
        }
    }

    function withdraw(address[] calldata tokens, address to) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            if(tokens[i] != eth){
                IERC20(tokens[i]).safeTransfer(to, IERC20(tokens[i]).balanceOf(address(this)));   
            } else {
                (bool success, ) = to.call{value: address(this).balance}("");
                require(success, "Failed to send ETH balance");
            }
        }
    }

    function claim() public nonReentrant {
        IERC20(aten).safeTransferFrom(owner(), msg.sender, presales[msg.sender]);
        presales[msg.sender] = 0;
    }

    /**
     * Returns the latest price in WEI
     */
    function getLatestPrice() public view returns (int) {
        (,int price,,,) = priceFeed.latestRoundData();
        return price;
    }

}