// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./StakingRewards.sol";
import "./PositionManager.sol";

contract Athena is Multicall, StakingRewards {
    
     struct Protocol {
        //id in mapping
        uint128 id;
        //Protocol name
        string name;
        //Protocol guarantee type, could be 0 = smart contract vuln, 1 = unpeg, 2 = rug pull ...
        uint8 guarantee;
        //address for the protocol interface to be unique
        address protocolIface;
        //compatibility with other protocols
        uint128[] compatibility;
    }

    mapping(uint128 => bool) public activeProtocols;
    Protocol[] public protocols;

    // StakingRewards private staking;
    PositionManager private positions;

    event NewProtocol(Protocol);

    constructor(address _stakingToken, address _rewardsToken) StakingRewards(_stakingToken, _rewardsToken) {
        // staking = new StakingRewards(_stakingToken, _rewardsToken);
        positions = new PositionManager();
    }

    function provideProtocolFund(uint128[] calldata protocolsId) public nonReentrant returns (bool) {
        for (uint256 i = 0; i < protocolsId.length; i++) {
            require(activeProtocols[protocolsId[i]] == true, "Protocol not active");
        }
        return positions.provideProtocolFund(protocolsId);
    }

    function addNewProtocol(string calldata name, uint8 guaranteeType, address iface, uint128[] calldata protocolsCompat) public onlyOwner {
        Protocol memory newProtocol = Protocol(uint128(protocols.length), name, guaranteeType, iface, protocolsCompat);
        protocols.push(newProtocol);
        activeProtocols[uint128(protocols.length - 1)] = true;
        emit NewProtocol(newProtocol);
    }

    function pauseProtocol(uint128 protocolId, bool pause) external onlyOwner {
        activeProtocols[protocolId] = pause;
    }

}