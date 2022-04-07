// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./StakingRewards.sol";
import "./interfaces/IPositionsManager.sol";
import "./library/PositionsLibrary.sol";

contract Athena is Multicall, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    struct Protocol {
        //id in mapping
        uint128 id;
        //compatibility with other protocols
        // uint128[] compatibility;
        //Protocol name
        string name;
        //address for the protocol interface to be unique
        address protocolAddress;
        //Premium rate to pay for this protocol
        uint8 premiumRate;
        //Protocol guarantee type, could be 0 = smart contract vuln, 1 = unpeg, 2 = rug pull ...
        uint8 guarantee;
    }

    mapping(uint128 => mapping(uint128 => bool))
        public incompatibilityProtocols;
    mapping(uint128 => bool) public activeProtocols;
    address public stablecoin;
    // AAVE lending pool
    address public lendingpool;
    address public positionsManager;
    address public stakedAtensGP;

    uint8 premiumDivisor;

    struct AtenDiscount {
        uint256 atenAmount;
        uint128 discount;
    }

    AtenDiscount[] public premiumAtenDiscounts;

    Protocol[] public protocols;
    StakingRewards private staking;
    // Vault private vaultManager;

    event NewProtocol(uint128);
    event AddGuarantee(
        address indexed from,
        uint256 capital,
        uint128[] protocolIds
    );

    constructor(
        address stablecoinUsed,
        address _stakingToken,
        address _rewardsToken,
        address aaveLendingPool
    ) {
        // vaultManager = new Vault(stablecoinUsed, address(this));
        staking = new StakingRewards(_stakingToken, _rewardsToken);
        stablecoin = stablecoinUsed;
        lendingpool = aaveLendingPool;
    }

    function initialize(address positionsAddress, address _stakedAtensGP)
        external
        onlyOwner
    {
        positionsManager = positionsAddress;
        stakedAtensGP = _stakedAtensGP;
        //initialized = true; //@dev required ?
    }

    function deposit(
        uint256 amount,
        uint256 atenToStake,
        PositionsLibrary.ProtocolPosition[] calldata _protocolsPositions
    ) public payable nonReentrant {
        require(
            IPositionsManager(positionsManager).balanceOf(msg.sender) == 0,
            "Already have a position"
        );
        for (uint256 index = 0; index < _protocolsPositions.length; index++) {
            require(
                activeProtocols[_protocolsPositions[index].protocolId] == true,
                "Protocol not active"
            );
            for (
                uint256 index2 = 0;
                index2 < _protocolsPositions.length;
                index2++
            ) {
                require(
                    incompatibilityProtocols[
                        _protocolsPositions[index].protocolId
                    ][_protocolsPositions[index2].protocolId] == false,
                    "Protocol not compatible"
                );
            }
            _mintProtocol(_protocolsPositions[index]);
        }
        _transferLiquidity(amount);
        //@dev TODO stake atens and get corresponding discount
        //_stakeAtens();
        uint128 discount = getDiscountWithAten(atenToStake);
        IPositionsManager(positionsManager).addLiquidity(
            msg.sender,
            discount,
            amount,
            atenToStake,
            _protocolsPositions
        );
    }

    function setDiscountWithAten(AtenDiscount[] calldata _discountToSet)
        public
        onlyOwner
    {
        for (uint256 index = 0; index < _discountToSet.length; index++) {
            premiumAtenDiscounts.push(_discountToSet[index]);
        }
    }

    function getDiscountWithAten(uint256 _amount)
        public
        view
        returns (uint128)
    {
        for (uint256 index = 0; index < premiumAtenDiscounts.length; index++) {
            if (_amount < premiumAtenDiscounts[index].atenAmount)
                return
                    index == 0 ? 0 : premiumAtenDiscounts[index - 1].discount;
        }
        // Else we are above max discount, so give it max discount
        return premiumAtenDiscounts[premiumAtenDiscounts.length - 1].discount;
    }

    function _transferLiquidity(uint256 _amount) internal {
        //@dev TODO Transfer to AAVE, get LP
        //@dev double check
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), _amount);
    }

    function _mintProtocol(
        PositionsLibrary.ProtocolPosition calldata _protocolPosition
    ) internal {}

    function addNewProtocol(
        string calldata name,
        uint8 guaranteeType,
        uint8 premium,
        address iface,
        uint128[] calldata protocolsNotCompat
    ) public onlyOwner {
        Protocol memory newProtocol = Protocol({
            id: uint128(protocols.length),
            name: name,
            protocolAddress: iface,
            premiumRate: premium,
            guarantee: guaranteeType
        });
        for (uint256 i = 0; i < protocolsNotCompat.length; i++) {
            incompatibilityProtocols[newProtocol.id][
                protocolsNotCompat[i]
            ] = true;
        }
        protocols.push(newProtocol);
        activeProtocols[uint128(protocols.length - 1)] = true;
        emit NewProtocol(newProtocol.id);
    }

    function pauseProtocol(uint128 protocolId, bool pause) external onlyOwner {
        activeProtocols[protocolId] = pause;
    }
}
