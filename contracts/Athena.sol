// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./ProtocolPool.sol";
import "./interfaces/IPositionsManager.sol";
import "./AAVE/ILendingPoolAddressesProvider.sol";
import "./AAVE/ILendingPool.sol";
import "./StakedAten.sol";
import "./PolicyManager.sol";

// import "./library/PositionsLibrary.sol";

contract Athena is Multicall, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    uint256 constant MAX_UINT256 = 2**256 - 1;
    struct Protocol {
        //id in mapping
        uint128 id;
        //Protocol Pool Address deployed
        address deployed;
        //Protocol name
        string name;
        //address for the protocol interface to be unique
        address protocolAddress;
        //Premium rate to pay for this protocol
        uint8 premiumRate;
        //Protocol guarantee type, could be 0 = smart contract vuln, 1 = unpeg, 2 = rug pull ...
        uint8 guarantee;
        //is Active or paused
        bool active;
    }

    mapping(uint128 => mapping(uint128 => bool))
        public incompatibilityProtocols;
    mapping(uint128 => Protocol) public protocolsMapping;
    address public stablecoin;
    // AAVE lending pool
    address public aaveAddressesRegistry;
    address public positionsManager;
    address public policyManager;
    address public stakedAtensGP;
    address public rewardsToken;

    uint8 private premiumDivisor;

    struct AtenDiscount {
        uint256 atenAmount;
        uint128 discount;
    }

    AtenDiscount[] public premiumAtenFees;

    uint128[] public protocols;

    event NewProtocol(uint128);
    event AddGuarantee(
        address indexed from,
        uint256 capital,
        uint128[] protocolIds
    );

    constructor(
        address _stablecoinUsed,
        address _rewardsToken,
        address _aaveAddressesRegistry
    ) {
        rewardsToken = _rewardsToken;
        stablecoin = _stablecoinUsed;
        aaveAddressesRegistry = _aaveAddressesRegistry;
    }

    function initialize(
        address _positionsAddress,
        address _stakedAtensGP,
        address _policyManagerAddress
    ) external onlyOwner {
        positionsManager = _positionsAddress;
        stakedAtensGP = _stakedAtensGP;
        policyManager = _policyManagerAddress;
        approveLendingPool();
        //initialized = true; //@dev required ?
    }

    function buyPolicy(
        uint256 _amountGuaranteed,
        uint256 _atensLocked,
        uint128 _protocolId
    ) public payable nonReentrant {
        require(_amountGuaranteed > 0, "Amount must be greater than 0");
        //@dev TODO get rate for price and durationw
        IERC20(stablecoin).safeTransferFrom(msg.sender, protocolsMapping[_protocolId].deployed, _amountGuaranteed);
        PolicyManager(policyManager).mint(
            msg.sender,
            _amountGuaranteed,
            _atensLocked,
            _protocolId
        );
    }

    function deposit(
        uint256 amount,
        uint256 atenToStake,
        uint128[] calldata _protocolIds,
        uint256[] calldata _amounts
    ) public payable nonReentrant {
        require(
            IPositionsManager(positionsManager).balanceOf(msg.sender) == 0,
            "Already have a position"
        );
        require(
            _protocolIds.length == _amounts.length,
            "Invalid deposit protocol length"
        );
        for (uint256 index = 0; index < _protocolIds.length; index++) {
            require(
                protocolsMapping[_protocolIds[index]].active == true,
                "Protocol not active"
            );
            for (
                uint256 index2 = index + 1;
                index2 < _protocolIds.length;
                index2++
            ) {
                //@Dev TODO WARNING issue here with protocols inverted ??
                require(
                    incompatibilityProtocols[_protocolIds[index2]][
                        _protocolIds[index]
                    ] ==
                        false &&
                        incompatibilityProtocols[_protocolIds[index]][
                            _protocolIds[index2]
                        ] ==
                        false,
                    "Protocol not compatible"
                );
            }
            ProtocolPool(protocolsMapping[_protocolIds[index]].deployed).mint(
                msg.sender,
                _amounts[index]
            );
        }
        _transferLiquidity(amount);
        //@dev TODO stake atens and get corresponding discount
        _stakeAtens(atenToStake, amount);
        uint128 fees = getFeesWithAten(atenToStake);
        IPositionsManager(positionsManager).mint(
            msg.sender,
            fees,
            amount,
            atenToStake,
            _protocolIds
        );
    }

    function _stakeAtens(uint256 atenToStake, uint256 amount) internal {
        StakedAten(stakedAtensGP).stake(msg.sender, atenToStake, amount);
    }

    function withdrawAtens(uint256 atenToWithdraw) external {
        //@dev TODO check if multiple NFT positions
        uint256 tokenId = IPositionsManager(positionsManager)
            .tokenOfOwnerByIndex(msg.sender, 0);
        (uint256 liquidity, uint128[] memory protocolsId) = IPositionsManager(
            positionsManager
        ).positions(tokenId);
        uint128 fees = getFeesWithAten(liquidity);
        uint256 actualAtens = StakedAten(stakedAtensGP).balanceOf(msg.sender);
        require(actualAtens > 0, "No Atens to withdraw");
        // require(atenToWithdraw <= actualAtens, "Not enough Atens to withdraw");
        StakedAten(stakedAtensGP).withdraw(msg.sender, atenToWithdraw);
        IPositionsManager(positionsManager).update(
            msg.sender,
            fees,
            liquidity,
            actualAtens - atenToWithdraw,
            protocolsId,
            tokenId
        );
    }

    function setFeesWithAten(AtenDiscount[] calldata _discountToSet)
        public
        onlyOwner
    {
        for (uint256 index = 0; index < _discountToSet.length; index++) {
            premiumAtenFees.push(_discountToSet[index]);
        }
    }

    function getFeesWithAten(uint256 _amount) public view returns (uint128) {
        for (uint256 index = 0; index < premiumAtenFees.length; index++) {
            if (_amount < premiumAtenFees[index].atenAmount)
                return index == 0 ? 0 : premiumAtenFees[index - 1].discount;
        }
        // Else we are above max discount, so give it max discount
        return premiumAtenFees[premiumAtenFees.length - 1].discount;
    }

    function approveLendingPool() internal {
        IERC20(stablecoin).safeApprove(
            ILendingPoolAddressesProvider(aaveAddressesRegistry)
                .getLendingPool(),
            MAX_UINT256
        );
    }

    function _transferLiquidity(uint256 _amount) internal {
        //@dev TODO Transfer to AAVE, get LP
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), _amount);
        address lendingPool = ILendingPoolAddressesProvider(
            aaveAddressesRegistry
        ).getLendingPool();
        ILendingPool(lendingPool).deposit(
            stablecoin,
            _amount,
            address(this),
            0
        );
    }

    function addNewProtocol(
        string calldata name,
        uint8 guaranteeType,
        uint8 premium,
        address iface,
        uint128[] calldata protocolsNotCompat
    ) public onlyOwner {
        uint128 newProtocolId = uint128(protocols.length);
        ProtocolPool _protocolDeployed = new ProtocolPool(
            address(this),
            rewardsToken,
            name,
            // A P P = Athena Protocol Pool
            string(abi.encodePacked("APP_", Strings.toString(newProtocolId)))
        );
        Protocol memory newProtocol = Protocol({
            id: newProtocolId,
            name: name,
            protocolAddress: iface,
            premiumRate: premium,
            guarantee: guaranteeType,
            deployed: address(_protocolDeployed),
            active: true
        });
        for (uint256 i = 0; i < protocolsNotCompat.length; i++) {
            incompatibilityProtocols[newProtocolId][
                protocolsNotCompat[i]
            ] = true;
        }
        protocolsMapping[newProtocolId] = newProtocol;
        protocols.push(newProtocolId);
        emit NewProtocol(newProtocolId);
    }

    function pauseProtocol(uint128 protocolId, bool pause) external onlyOwner {
        protocolsMapping[protocolId].active = pause;
    }
}
