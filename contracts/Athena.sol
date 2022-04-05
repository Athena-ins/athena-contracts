// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./StakingRewards.sol";
// import "./Vault.sol";
import "./interfaces/IPositionsManager.sol";

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

    uint8 premiumDivisor;

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

    function deposit(
        uint256 amount,
        address token,
        uint128[] calldata protocolsId
    ) public payable nonReentrant {
        require(token == address(stablecoin), "Wrong ERC20 used for deposit");
        for (uint256 i = 0; i < protocolsId.length; i++) {
            require(
                activeProtocols[protocolsId[i]] == true,
                "Protocol not active"
            );
        }
        for (uint256 index = 0; index < protocolsId.length; index++) {
            for (uint256 index2 = 0; index2 < protocolsId.length; index2++) {
                require(
                    incompatibilityProtocols[protocolsId[index]][
                        protocolsId[index2]
                    ] == false,
                    "Protocol not compatible"
                );
            }
            _mintProtocol(protocolsId[index]);
        }
        _transferLiquidity(amount);
        IPositionsManager(positionsManager).addLiquidity(
            msg.sender,
            0,
            amount,
            protocolsId
        );
    }

    function _transferLiquidity(uint256 amount) internal {
        //@dev TODO Transfer to AAVE, get LP
        //@dev double check
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), amount);
    }

    function _mintProtocol(uint128 protocolId) internal {}

    function initialize(address positionsAddress) external onlyOwner {
        positionsManager = positionsAddress;
        //initialized = true; //@dev required ?
    }

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
