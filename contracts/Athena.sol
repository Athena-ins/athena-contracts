// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./ProtocolPool.sol";
import "./interfaces/IPositionsManager.sol";
import "./StakedAten.sol";

// import "./library/PositionsLibrary.sol";

contract Athena is Multicall, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
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
    }

    mapping(uint128 => mapping(uint128 => bool))
        public incompatibilityProtocols;
    mapping(uint128 => bool) public activeProtocols;
    address public stablecoin;
    // AAVE lending pool
    address public lendingpool;
    address public positionsManager;
    address public stakedAtensGP;
    address public rewardsToken;

    uint8 private premiumDivisor;

    struct AtenDiscount {
        uint256 atenAmount;
        uint128 discount;
    }

    AtenDiscount[] public premiumAtenFees;

    Protocol[] public protocols;

    event NewProtocol(uint128);
    event AddGuarantee(
        address indexed from,
        uint256 capital,
        uint128[] protocolIds
    );

    constructor(
        address stablecoinUsed,
        address _rewardsToken,
        address aaveLendingPool
    ) {
        rewardsToken = _rewardsToken;
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
                activeProtocols[_protocolIds[index]] == true,
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
            ProtocolPool(protocols[_protocolIds[index]].deployed).mint(
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

    function setFeesWithAten(AtenDiscount[] calldata _discountToSet)
        public
        onlyOwner
    {
        for (uint256 index = 0; index < _discountToSet.length; index++) {
            premiumAtenFees.push(_discountToSet[index]);
        }
    }

    function getFeesWithAten(uint256 _amount)
        public
        view
        returns (uint128)
    {
        for (uint256 index = 0; index < premiumAtenFees.length; index++) {
            if (_amount < premiumAtenFees[index].atenAmount)
                return
                    index == 0 ? 0 : premiumAtenFees[index - 1].discount;
        }
        // Else we are above max discount, so give it max discount
        return premiumAtenFees[premiumAtenFees.length - 1].discount;
    }

    function _transferLiquidity(uint256 _amount) internal {
        //@dev TODO Transfer to AAVE, get LP
        //@dev double check
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), _amount);
    }

    function addNewProtocol(
        string calldata name,
        uint8 guaranteeType,
        uint8 premium,
        address iface,
        uint128[] calldata protocolsNotCompat
    ) public onlyOwner {
        ProtocolPool _protocolDeployed = new ProtocolPool(
            address(this),
            rewardsToken,
            name,
            string(abi.encodePacked("AT_PROTO_", protocols.length))
        );
        Protocol memory newProtocol = Protocol({
            id: uint128(protocols.length),
            name: name,
            protocolAddress: iface,
            premiumRate: premium,
            guarantee: guaranteeType,
            deployed: address(_protocolDeployed)
        });
        for (uint256 i = 0; i < protocolsNotCompat.length; i++) {
            incompatibilityProtocols[newProtocol.id][
                protocolsNotCompat[i]
            ] = true;
        }
        activeProtocols[uint128(protocols.length)] = true;
        protocols.push(newProtocol);
        emit NewProtocol(newProtocol.id);
    }

    function pauseProtocol(uint128 protocolId, bool pause) external onlyOwner {
        activeProtocols[protocolId] = pause;
    }
}
