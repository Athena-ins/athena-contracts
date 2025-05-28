**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary
 - [arbitrary-send-erc20](#arbitrary-send-erc20) (2 results) (High)
 - [arbitrary-send-eth](#arbitrary-send-eth) (1 results) (High)
 - [weak-prng](#weak-prng) (1 results) (High)
 - [incorrect-exp](#incorrect-exp) (1 results) (High)
 - [incorrect-return](#incorrect-return) (1 results) (High)
 - [reentrancy-eth](#reentrancy-eth) (1 results) (High)
 - [unchecked-transfer](#unchecked-transfer) (1 results) (High)
 - [uninitialized-state](#uninitialized-state) (7 results) (High)
 - [divide-before-multiply](#divide-before-multiply) (14 results) (Medium)
 - [incorrect-equality](#incorrect-equality) (10 results) (Medium)
 - [reentrancy-no-eth](#reentrancy-no-eth) (17 results) (Medium)
 - [tautology](#tautology) (1 results) (Medium)
 - [unchecked-lowlevel](#unchecked-lowlevel) (1 results) (Medium)
 - [uninitialized-local](#uninitialized-local) (10 results) (Medium)
## arbitrary-send-erc20
Impact: High
Confidence: High
 - [ ] ID-0
[FarmingRange.attemptTransfer(IERC20,address,address,uint256)](src/rewards/FarmingRange.sol#L1053-L1063) uses arbitrary from in transferFrom: [_token.safeTransferFrom(_from,_to,_amount)](src/rewards/FarmingRange.sol#L1062)

src/rewards/FarmingRange.sol#L1053-L1063


 - [ ] ID-1
[FarmingRange._transferFromWithAllowance(IERC20,uint256,uint256)](src/rewards/FarmingRange.sol#L1175-L1200) uses arbitrary from in transferFrom: [_rewardToken.safeTransferFrom(rewardManager,address(this),_amount)](src/rewards/FarmingRange.sol#L1194-L1198)

src/rewards/FarmingRange.sol#L1175-L1200


## arbitrary-send-eth
Impact: High
Confidence: Medium
 - [ ] ID-2
[WrappedTokenGateway._safeTransferETH(address,uint256)](src/misc/WrappedTokenGateway.sol#L194-L197) sends eth to arbitrary user
	Dangerous calls:
	- [(success,None) = to.call{value: value}()](src/misc/WrappedTokenGateway.sol#L195)

src/misc/WrappedTokenGateway.sol#L194-L197


## weak-prng
Impact: High
Confidence: Medium
 - [ ] ID-3
[VirtualPool._refreshSlot0(uint64,uint256)](src/libs/VirtualPool.sol#L228-L309) uses a weak PRNG: "[secondsSinceTickStart = remaining % slot0.secondsPerTick](src/libs/VirtualPool.sol#L291)" 

src/libs/VirtualPool.sol#L228-L309


## incorrect-exp
Impact: High
Confidence: Medium
 - [ ] ID-4
[Math.mulDiv(uint256,uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223) has bitwise-xor operator ^ instead of the exponentiation operator **: 
	 - [inverse = (3 * denominator) ^ 2](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L205)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223


## incorrect-return
Impact: High
Confidence: Medium
 - [ ] ID-5
[TransparentUpgradeableProxy._fallback()](node_modules/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol#L95-L105) calls [Proxy._fallback()](node_modules/@openzeppelin/contracts/proxy/Proxy.sol#L58-L60) which halt the execution [return(uint256,uint256)(0,returndatasize()())](node_modules/@openzeppelin/contracts/proxy/Proxy.sol#L42)

node_modules/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol#L95-L105


## reentrancy-eth
Impact: High
Confidence: Medium
 - [ ] ID-6
Reentrancy in [ClaimManager.disputeClaim(uint256)](src/managers/ClaimManager.sol#L795-L839):
	External calls:
	- [disputeId = arbitrator.createDispute{value: costOfArbitration}(NUMBER_OF_RULING_OPTIONS,klerosExtraData)](src/managers/ClaimManager.sol#L816-L818)
	State variables written after the call(s):
	- [claim.status = ClaimStatus.Disputed](src/managers/ClaimManager.sol#L821)
	[ClaimManager.claims](src/managers/ClaimManager.sol#L70) can be used in cross function reentrancies:
	- [ClaimManager._checkCanUploadEvidence(uint256)](src/managers/ClaimManager.sol#L613-L653)
	- [ClaimManager._claimViewData(uint256)](src/managers/ClaimManager.sol#L355-L400)
	- [ClaimManager.claims](src/managers/ClaimManager.sol#L70)
	- [ClaimManager.claimsExists(uint256)](src/managers/ClaimManager.sol#L162-L165)
	- [ClaimManager.getTotalWithdrawableAmount(uint256,address,uint256)](src/managers/ClaimManager.sol#L286-L306)
	- [ClaimManager.getWithdrawableAmount(uint256,address,uint256,uint256)](src/managers/ClaimManager.sol#L257-L276)
	- [ClaimManager.hasAcceptationFinalized(uint256)](src/managers/ClaimManager.sol#L212-L223)
	- [ClaimManager.hasAutoResolved(uint256)](src/managers/ClaimManager.sol#L194-L206)
	- [ClaimManager.overrule(uint256,bool)](src/managers/ClaimManager.sol#L1112-L1140)
	- [ClaimManager.submitEvidence(uint256,string)](src/managers/ClaimManager.sol#L663-L684)
	- [ClaimManager.submitEvidenceForClaim(uint256,string[])](src/managers/ClaimManager.sol#L692-L716)
	- [claim.prosecutor = msg.sender](src/managers/ClaimManager.sol#L822)
	[ClaimManager.claims](src/managers/ClaimManager.sol#L70) can be used in cross function reentrancies:
	- [ClaimManager._checkCanUploadEvidence(uint256)](src/managers/ClaimManager.sol#L613-L653)
	- [ClaimManager._claimViewData(uint256)](src/managers/ClaimManager.sol#L355-L400)
	- [ClaimManager.claims](src/managers/ClaimManager.sol#L70)
	- [ClaimManager.claimsExists(uint256)](src/managers/ClaimManager.sol#L162-L165)
	- [ClaimManager.getTotalWithdrawableAmount(uint256,address,uint256)](src/managers/ClaimManager.sol#L286-L306)
	- [ClaimManager.getWithdrawableAmount(uint256,address,uint256,uint256)](src/managers/ClaimManager.sol#L257-L276)
	- [ClaimManager.hasAcceptationFinalized(uint256)](src/managers/ClaimManager.sol#L212-L223)
	- [ClaimManager.hasAutoResolved(uint256)](src/managers/ClaimManager.sol#L194-L206)
	- [ClaimManager.overrule(uint256,bool)](src/managers/ClaimManager.sol#L1112-L1140)
	- [ClaimManager.submitEvidence(uint256,string)](src/managers/ClaimManager.sol#L663-L684)
	- [ClaimManager.submitEvidenceForClaim(uint256,string[])](src/managers/ClaimManager.sol#L692-L716)
	- [claim.disputeId = disputeId](src/managers/ClaimManager.sol#L823)
	[ClaimManager.claims](src/managers/ClaimManager.sol#L70) can be used in cross function reentrancies:
	- [ClaimManager._checkCanUploadEvidence(uint256)](src/managers/ClaimManager.sol#L613-L653)
	- [ClaimManager._claimViewData(uint256)](src/managers/ClaimManager.sol#L355-L400)
	- [ClaimManager.claims](src/managers/ClaimManager.sol#L70)
	- [ClaimManager.claimsExists(uint256)](src/managers/ClaimManager.sol#L162-L165)
	- [ClaimManager.getTotalWithdrawableAmount(uint256,address,uint256)](src/managers/ClaimManager.sol#L286-L306)
	- [ClaimManager.getWithdrawableAmount(uint256,address,uint256,uint256)](src/managers/ClaimManager.sol#L257-L276)
	- [ClaimManager.hasAcceptationFinalized(uint256)](src/managers/ClaimManager.sol#L212-L223)
	- [ClaimManager.hasAutoResolved(uint256)](src/managers/ClaimManager.sol#L194-L206)
	- [ClaimManager.overrule(uint256,bool)](src/managers/ClaimManager.sol#L1112-L1140)
	- [ClaimManager.submitEvidence(uint256,string)](src/managers/ClaimManager.sol#L663-L684)
	- [ClaimManager.submitEvidenceForClaim(uint256,string[])](src/managers/ClaimManager.sol#L692-L716)
	- [claim.challengedTimestamp = uint64(block.timestamp)](src/managers/ClaimManager.sol#L824)
	[ClaimManager.claims](src/managers/ClaimManager.sol#L70) can be used in cross function reentrancies:
	- [ClaimManager._checkCanUploadEvidence(uint256)](src/managers/ClaimManager.sol#L613-L653)
	- [ClaimManager._claimViewData(uint256)](src/managers/ClaimManager.sol#L355-L400)
	- [ClaimManager.claims](src/managers/ClaimManager.sol#L70)
	- [ClaimManager.claimsExists(uint256)](src/managers/ClaimManager.sol#L162-L165)
	- [ClaimManager.getTotalWithdrawableAmount(uint256,address,uint256)](src/managers/ClaimManager.sol#L286-L306)
	- [ClaimManager.getWithdrawableAmount(uint256,address,uint256,uint256)](src/managers/ClaimManager.sol#L257-L276)
	- [ClaimManager.hasAcceptationFinalized(uint256)](src/managers/ClaimManager.sol#L212-L223)
	- [ClaimManager.hasAutoResolved(uint256)](src/managers/ClaimManager.sol#L194-L206)
	- [ClaimManager.overrule(uint256,bool)](src/managers/ClaimManager.sol#L1112-L1140)
	- [ClaimManager.submitEvidence(uint256,string)](src/managers/ClaimManager.sol#L663-L684)
	- [ClaimManager.submitEvidenceForClaim(uint256,string[])](src/managers/ClaimManager.sol#L692-L716)

src/managers/ClaimManager.sol#L795-L839


## unchecked-transfer
Impact: High
Confidence: Medium
 - [ ] ID-7
[WrappedTokenGateway._convertEthToWrappedLidoETH(uint256)](src/misc/WrappedTokenGateway.sol#L204-L221) ignores return value by [WETH.transferFrom(msg.sender,address(this),selectedAmount)](src/misc/WrappedTokenGateway.sol#L211)

src/misc/WrappedTokenGateway.sol#L204-L221


## uninitialized-state
Impact: High
Confidence: High
 - [ ] ID-8
[StrategyManagerVL.aaveLendingPool](src/managers/StrategyManagerVL.sol#L63) is never initialized. It is used in:
	- [StrategyManagerVL.getRewardIndex(uint256)](src/managers/StrategyManagerVL.sol#L158-L169)
	- [StrategyManagerVL.getRewardRate(uint256)](src/managers/StrategyManagerVL.sol#L179-L191)
	- [StrategyManagerVL._accrueToDao(address,uint256)](src/managers/StrategyManagerVL.sol#L312-L333)
	- [StrategyManagerVL.depositToStrategy(uint256,uint256)](src/managers/StrategyManagerVL.sol#L342-L368)
	- [StrategyManagerVL.withdrawFromStrategy(uint256,uint256,uint256,address,uint256)](src/managers/StrategyManagerVL.sol#L378-L430)
	- [StrategyManagerVL.payoutFromStrategy(uint256,uint256,address)](src/managers/StrategyManagerVL.sol#L507-L543)

src/managers/StrategyManagerVL.sol#L63


 - [ ] ID-9
[StrategyManagerVL.aUSDC](src/managers/StrategyManagerVL.sol#L65) is never initialized. It is used in:
	- [StrategyManagerVL.wrappedAsset(uint256)](src/managers/StrategyManagerVL.sol#L242-L255)

src/managers/StrategyManagerVL.sol#L65


 - [ ] ID-10
[ClaimManager.claimIdToEvidence](src/managers/ClaimManager.sol#L78-L79) is never initialized. It is used in:
	- [ClaimManager._claimViewData(uint256)](src/managers/ClaimManager.sol#L355-L400)
	- [ClaimManager.getClaimEvidence(uint256)](src/managers/ClaimManager.sol#L483-L487)
	- [ClaimManager.submitEvidence(uint256,string)](src/managers/ClaimManager.sol#L663-L684)
	- [ClaimManager.submitEvidenceForClaim(uint256,string[])](src/managers/ClaimManager.sol#L692-L716)

src/managers/ClaimManager.sol#L78-L79


 - [ ] ID-11
[ClaimManager.claimIdToCounterEvidence](src/managers/ClaimManager.sol#L80-L81) is never initialized. It is used in:
	- [ClaimManager._claimViewData(uint256)](src/managers/ClaimManager.sol#L355-L400)
	- [ClaimManager.getClaimCounterEvidence(uint256)](src/managers/ClaimManager.sol#L494-L498)
	- [ClaimManager.submitEvidence(uint256,string)](src/managers/ClaimManager.sol#L663-L684)
	- [ClaimManager.submitEvidenceForClaim(uint256,string[])](src/managers/ClaimManager.sol#L692-L716)

src/managers/ClaimManager.sol#L80-L81


 - [ ] ID-12
[StrategyManagerVL.USDC](src/managers/StrategyManagerVL.sol#L64) is never initialized. It is used in:
	- [StrategyManagerVL.getRewardIndex(uint256)](src/managers/StrategyManagerVL.sol#L158-L169)
	- [StrategyManagerVL.getRewardRate(uint256)](src/managers/StrategyManagerVL.sol#L179-L191)
	- [StrategyManagerVL.underlyingAsset(uint256)](src/managers/StrategyManagerVL.sol#L224-L235)
	- [StrategyManagerVL._accrueToDao(address,uint256)](src/managers/StrategyManagerVL.sol#L312-L333)
	- [StrategyManagerVL.depositToStrategy(uint256,uint256)](src/managers/StrategyManagerVL.sol#L342-L368)
	- [StrategyManagerVL.withdrawFromStrategy(uint256,uint256,uint256,address,uint256)](src/managers/StrategyManagerVL.sol#L378-L430)
	- [StrategyManagerVL.payoutFromStrategy(uint256,uint256,address)](src/managers/StrategyManagerVL.sol#L507-L543)

src/managers/StrategyManagerVL.sol#L64


 - [ ] ID-13
[FarmingRange._balances](src/rewards/FarmingRange.sol#L96-L97) is never initialized. It is used in:
	- [FarmingRange.depositedLpTokens(address)](src/rewards/FarmingRange.sol#L145-L149)
	- [FarmingRange.depositedCoverTokens(address)](src/rewards/FarmingRange.sol#L151-L155)
	- [FarmingRange._addToken(address,uint256,IFarmingRange.AssetType)](src/rewards/FarmingRange.sol#L157-L168)
	- [FarmingRange._removeToken(address,uint256,IFarmingRange.AssetType)](src/rewards/FarmingRange.sol#L170-L193)
	- [FarmingRange._removeCoverToken(address,uint256)](src/rewards/FarmingRange.sol#L195-L209)

src/rewards/FarmingRange.sol#L96-L97


 - [ ] ID-14
[FarmingRange.campaignRewardInfo](src/rewards/FarmingRange.sol#L83-L84) is never initialized. It is used in:
	- [FarmingRange.addRewardInfo(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L733-L776)
	- [FarmingRange.updateRewardInfo(uint256,uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L797-L880)
	- [FarmingRange.removeLastRewardInfo(uint256)](src/rewards/FarmingRange.sol#L938-L974)
	- [FarmingRange.rewardInfoLen(uint256)](src/rewards/FarmingRange.sol#L977-L981)
	- [FarmingRange._endBlockOf(uint256,uint256)](src/rewards/FarmingRange.sol#L1071-L1091)
	- [FarmingRange._rewardPerBlockOf(uint256,uint256)](src/rewards/FarmingRange.sol#L1099-L1119)
	- [FarmingRange._pendingReward(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L1209-L1242)
	- [FarmingRange._updateCampaign(uint256)](src/rewards/FarmingRange.sol#L1249-L1321)

src/rewards/FarmingRange.sol#L83-L84


## divide-before-multiply
Impact: Medium
Confidence: Medium
 - [ ] ID-15
[EcclesiaDao.earlyWithdraw(uint256)](src/misc/EcclesiaDao.sol#L455-L500) performs a multiplication on the result of a division:
	- [_penalty = (earlyWithdrawBpsPerDay * remainingDays * amount_) / RAY](src/misc/EcclesiaDao.sol#L478-L480)
	- [_amountBurn = (_penalty * burnBps) / RAY](src/misc/EcclesiaDao.sol#L489)

src/misc/EcclesiaDao.sol#L455-L500


 - [ ] ID-16
[Math.mulDiv(uint256,uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L190)
	- [inverse *= 2 - denominator * inverse](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L211)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223


 - [ ] ID-17
[Math.invMod(uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L243-L289) performs a multiplication on the result of a division:
	- [quotient = gcd / remainder](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L265)
	- [(gcd,remainder) = (remainder,gcd - remainder * quotient)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L267-L274)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L243-L289


 - [ ] ID-18
[Math.mulDiv(uint256,uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L190)
	- [inverse *= 2 - denominator * inverse](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L213)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223


 - [ ] ID-19
[Math.mulDiv(uint256,uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L190)
	- [inverse *= 2 - denominator * inverse](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L212)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223


 - [ ] ID-20
[FarmingRange.updateRewardInfo(uint256,uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L797-L880) performs a multiplication on the result of a division:
	- [_currentRewardPerBlock = (_currentRewardPerBlock * _initialBlockRange) / _nextBlockRange](src/rewards/FarmingRange.sol#L855-L857)
	- [_nextTotal = _nextBlockRange * _currentRewardPerBlock](src/rewards/FarmingRange.sol#L858)

src/rewards/FarmingRange.sol#L797-L880


 - [ ] ID-21
[Math.mulDiv(uint256,uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L190)
	- [inverse *= 2 - denominator * inverse](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L214)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223


 - [ ] ID-22
[Math.mulDiv(uint256,uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223) performs a multiplication on the result of a division:
	- [prod0 = prod0 / twos](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L193)
	- [result = prod0 * inverse](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L220)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223


 - [ ] ID-23
[Math.mulDiv(uint256,uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L190)
	- [inverse *= 2 - denominator * inverse](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L210)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223


 - [ ] ID-24
[Math.mulDiv(uint256,uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L190)
	- [inverse *= 2 - denominator * inverse](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L209)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223


 - [ ] ID-25
[EcclesiaDao.earlyWithdraw(uint256)](src/misc/EcclesiaDao.sol#L455-L500) performs a multiplication on the result of a division:
	- [_penalty = (earlyWithdrawBpsPerDay * remainingDays * amount_) / RAY](src/misc/EcclesiaDao.sol#L478-L480)
	- [_amountRedistribute = (_penalty * redistributeBps) / RAY](src/misc/EcclesiaDao.sol#L486)

src/misc/EcclesiaDao.sol#L455-L500


 - [ ] ID-26
[Math.mulDiv(uint256,uint256,uint256)](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L190)
	- [inverse = (3 * denominator) ^ 2](node_modules/@openzeppelin/contracts/utils/math/Math.sol#L205)

node_modules/@openzeppelin/contracts/utils/math/Math.sol#L144-L223


 - [ ] ID-27
[EcclesiaDao.earlyWithdraw(uint256)](src/misc/EcclesiaDao.sol#L455-L500) performs a multiplication on the result of a division:
	- [remainingDays = (_prevLockEnd + 86400 - block.timestamp) / 86400](src/misc/EcclesiaDao.sol#L474-L476)
	- [_penalty = (earlyWithdrawBpsPerDay * remainingDays * amount_) / RAY](src/misc/EcclesiaDao.sol#L478-L480)

src/misc/EcclesiaDao.sol#L455-L500


 - [ ] ID-28
[EcclesiaDao.tokenToVotes(uint256,uint256)](src/misc/EcclesiaDao.sol#L196-L210) performs a multiplication on the result of a division:
	- [votes = (amount_ * bias) / RAY](src/misc/EcclesiaDao.sol#L209)
	- [bias = (lockDuration_ * RAY) / EQUILIBRIUM_LOCK](src/misc/EcclesiaDao.sol#L203-L207)

src/misc/EcclesiaDao.sol#L196-L210


## incorrect-equality
Impact: Medium
Confidence: High
 - [ ] ID-29
[Staking.amountToYieldBonus(uint256)](src/rewards/Staking.sol#L394-L409) uses a dangerous strict equality:
	- [stakedAten_ == 0](src/rewards/Staking.sol#L398)

src/rewards/Staking.sol#L394-L409


 - [ ] ID-30
[ClaimManager.getTotalWithdrawableAmount(uint256,address,uint256)](src/managers/ClaimManager.sol#L286-L306) uses a dangerous strict equality:
	- [claims[claimId_].rulingTimestamp == 0](src/managers/ClaimManager.sol#L292)

src/managers/ClaimManager.sol#L286-L306


 - [ ] ID-31
[MerkleDistributor.acceptRoot()](src/misc/MerkleDistributor.sol#L178-L184) uses a dangerous strict equality:
	- [pendingRoot.validAt == 0](src/misc/MerkleDistributor.sol#L179)

src/misc/MerkleDistributor.sol#L178-L184


 - [ ] ID-32
[ClaimManager.getWithdrawableAmount(uint256,address,uint256,uint256)](src/managers/ClaimManager.sol#L257-L276) uses a dangerous strict equality:
	- [claims[claimId_].rulingTimestamp == 0](src/managers/ClaimManager.sol#L264)

src/managers/ClaimManager.sol#L257-L276


 - [ ] ID-33
[Staking.deposit(uint256)](src/rewards/Staking.sol#L128-L168) uses a dangerous strict equality:
	- [_userNewShares == 0](src/rewards/Staking.sol#L149)

src/rewards/Staking.sol#L128-L168


 - [ ] ID-34
[Staking.withdraw(address,uint256)](src/rewards/Staking.sol#L201-L230) uses a dangerous strict equality:
	- [_sharesAmount == 0 || userInfo[msg.sender].shares < _sharesAmount](src/rewards/Staking.sol#L206-L207)

src/rewards/Staking.sol#L201-L230


 - [ ] ID-35
[ClaimManager.claimsExists(uint256)](src/managers/ClaimManager.sol#L162-L165) uses a dangerous strict equality:
	- [claims[claimId_].createdAt == 0](src/managers/ClaimManager.sol#L163)

src/managers/ClaimManager.sol#L162-L165


 - [ ] ID-36
[ClaimManager._withdrawableAmount(uint256,address,uint256,uint256,uint256)](src/managers/ClaimManager.sol#L560-L590) uses a dangerous strict equality:
	- [finalRuling == side_ && 0 < paidFees](src/managers/ClaimManager.sol#L583)

src/managers/ClaimManager.sol#L560-L590


 - [ ] ID-37
[FarmingRange.depositLpNft(uint256[],uint256)](src/rewards/FarmingRange.sol#L300-L346) uses a dangerous strict equality:
	- [campaignPoolId == poolIds[j]](src/rewards/FarmingRange.sol#L328)

src/rewards/FarmingRange.sol#L300-L346


 - [ ] ID-38
[MerkleDistributor.claim(address,address,uint256,bytes32[])](src/misc/MerkleDistributor.sol#L203-L232) uses a dangerous strict equality:
	- [root == bytes32(0)](src/misc/MerkleDistributor.sol#L209)

src/misc/MerkleDistributor.sol#L203-L232


## reentrancy-no-eth
Impact: Medium
Confidence: Medium
 - [ ] ID-39
Reentrancy in [EcclesiaDao.withdraw()](src/misc/EcclesiaDao.sol#L428-L449):
	External calls:
	- [_unlock(_lock,_amount)](src/misc/EcclesiaDao.sol#L442)
		- [staking.withdrawTokenDao(msg.sender,address(this),withdrawAmount_)](src/misc/EcclesiaDao.sol#L407-L411)
	State variables written after the call(s):
	- [harvest(revenueTokens)](src/misc/EcclesiaDao.sol#L446)
		- [userLock.userStakingIndex = stakingIndex](src/misc/EcclesiaDao.sol#L589)
		- [userLock.userRedisIndex = redistributeIndex](src/misc/EcclesiaDao.sol#L591)
	[EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136) can be used in cross function reentrancies:
	- [EcclesiaDao._deposit(uint256,uint256)](src/misc/EcclesiaDao.sol#L254-L300)
	- [EcclesiaDao.createLock(uint256,uint256)](src/misc/EcclesiaDao.sol#L309-L329)
	- [EcclesiaDao.harvest(address[])](src/misc/EcclesiaDao.sol#L563-L614)
	- [EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136)

src/misc/EcclesiaDao.sol#L428-L449


 - [ ] ID-40
Reentrancy in [LiquidityManager._takeInterests(uint256,address,uint256)](src/managers/LiquidityManager.sol#L574-L634):
	External calls:
	- [(newUserCapital,strategyRewards) = VirtualPool._takePoolInterests(position.poolIds[i],positionId_,coverRewardsBeneficiary_,position.supplied,position.strategyRewardIndex,latestStrategyRewardIndex,yieldBonus_,position.poolIds)](src/managers/LiquidityManager.sol#L601-L611)
	- [strategyManager.withdrawFromStrategy(strategyId,0,strategyRewards,posOwner,yieldBonus_)](src/managers/LiquidityManager.sol#L620-L626)
	State variables written after the call(s):
	- [position.strategyRewardIndex = latestStrategyRewardIndex](src/managers/LiquidityManager.sol#L629)
	[LiquidityManager._positions](src/managers/LiquidityManager.sol#L84) can be used in cross function reentrancies:
	- [LiquidityManager._positions](src/managers/LiquidityManager.sol#L84)
	- [LiquidityManager._takeInterests(uint256,address,uint256)](src/managers/LiquidityManager.sol#L574-L634)
	- [LiquidityManager.positionInfo(uint256)](src/managers/LiquidityManager.sol#L240-L245)
	- [LiquidityManager.positionInfos(uint256[])](src/managers/LiquidityManager.sol#L276-L294)
	- [LiquidityManager.positions(uint256)](src/managers/LiquidityManager.sol#L229-L233)
	- [position.supplied = newUserCapital](src/managers/LiquidityManager.sol#L631)
	[LiquidityManager._positions](src/managers/LiquidityManager.sol#L84) can be used in cross function reentrancies:
	- [LiquidityManager._positions](src/managers/LiquidityManager.sol#L84)
	- [LiquidityManager._takeInterests(uint256,address,uint256)](src/managers/LiquidityManager.sol#L574-L634)
	- [LiquidityManager.positionInfo(uint256)](src/managers/LiquidityManager.sol#L240-L245)
	- [LiquidityManager.positionInfos(uint256[])](src/managers/LiquidityManager.sol#L276-L294)
	- [LiquidityManager.positions(uint256)](src/managers/LiquidityManager.sol#L229-L233)

src/managers/LiquidityManager.sol#L574-L634


 - [ ] ID-41
Reentrancy in [LiquidityManager.updatePositionUpTo(uint256,uint256[])](src/managers/LiquidityManager.sol#L1290-L1356):
	External calls:
	- [VirtualPool._payRewardsAndFees(position.poolIds[i],info.coverRewards,account,0,position.poolIds.length)](src/managers/LiquidityManager.sol#L1342-L1348)
	State variables written after the call(s):
	- [position.strategyRewardIndex = latestStrategyRewardIndex](src/managers/LiquidityManager.sol#L1354)
	[LiquidityManager._positions](src/managers/LiquidityManager.sol#L84) can be used in cross function reentrancies:
	- [LiquidityManager._positions](src/managers/LiquidityManager.sol#L84)
	- [LiquidityManager._takeInterests(uint256,address,uint256)](src/managers/LiquidityManager.sol#L574-L634)
	- [LiquidityManager.positionInfo(uint256)](src/managers/LiquidityManager.sol#L240-L245)
	- [LiquidityManager.positionInfos(uint256[])](src/managers/LiquidityManager.sol#L276-L294)
	- [LiquidityManager.positions(uint256)](src/managers/LiquidityManager.sol#L229-L233)

src/managers/LiquidityManager.sol#L1290-L1356


 - [ ] ID-42
Reentrancy in [FarmingRange.depositWithPermit(uint256,uint256,bool,uint256,uint8,bytes32,bytes32)](src/rewards/FarmingRange.sol#L399-L420):
	External calls:
	- [IERC20Permit(address(campaignInfo[_campaignID].stakingToken)).permit(msg.sender,address(this),type()(uint256).max,_deadline,_v,_r,_s)](src/rewards/FarmingRange.sol#L408-L417)
	- [IERC20Permit(address(campaignInfo[_campaignID].stakingToken)).permit(msg.sender,address(this),_amount,_deadline,_v,_r,_s)](src/rewards/FarmingRange.sol#L408-L417)
	State variables written after the call(s):
	- [deposit(_campaignID,_amount)](src/rewards/FarmingRange.sol#L419)
		- [campaign.totalStaked = campaign.totalStaked + _amount](src/rewards/FarmingRange.sol#L273)
		- [campaign.lastRewardBlock = block.number](src/rewards/FarmingRange.sol#L1290)
		- [campaign.lastRewardBlock = _rewardInfo[_i_scope_0].endBlock](src/rewards/FarmingRange.sol#L1308)
		- [campaign.lastRewardBlock = block.number](src/rewards/FarmingRange.sol#L1310)
		- [campaign.accRewardPerShare = campaign.accRewardPerShare + ((_multiplier * _rewardInfo[_i_scope_0].rewardPerBlock * 1e20) / campaign.totalStaked)](src/rewards/FarmingRange.sol#L1312-L1315)
	[FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86) can be used in cross function reentrancies:
	- [FarmingRange._deposit(uint256,uint256,bool,uint256)](src/rewards/FarmingRange.sol#L248-L279)
	- [FarmingRange._pendingReward(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L1209-L1242)
	- [FarmingRange._updateCampaign(uint256)](src/rewards/FarmingRange.sol#L1249-L1321)
	- [FarmingRange.addCampaignInfo(IFarmingRange.AssetType,uint256,IERC20,IERC20,uint256)](src/rewards/FarmingRange.sol#L697-L730)
	- [FarmingRange.addRewardInfo(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L733-L776)
	- [FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86)
	- [FarmingRange.campaignInfoLen()](src/rewards/FarmingRange.sol#L984-L986)
	- [FarmingRange.deposit(uint256,uint256)](src/rewards/FarmingRange.sol#L282-L298)
	- [FarmingRange.depositWithPermit(uint256,uint256,bool,uint256,uint8,bytes32,bytes32)](src/rewards/FarmingRange.sol#L399-L420)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [FarmingRange.removeLastRewardInfo(uint256)](src/rewards/FarmingRange.sol#L938-L974)
	- [FarmingRange.updateRewardInfo(uint256,uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L797-L880)

src/rewards/FarmingRange.sol#L399-L420


 - [ ] ID-43
Reentrancy in [LiquidityManager.removeLiquidity(uint256,uint256,bool)](src/managers/LiquidityManager.sol#L733-L801):
	External calls:
	- [_closeWithdrawalCommit(positionId_)](src/managers/LiquidityManager.sol#L749)
		- [(newUserCapital,strategyRewards) = VirtualPool._takePoolInterests(position.poolIds[i],positionId_,coverRewardsBeneficiary_,position.supplied,position.strategyRewardIndex,latestStrategyRewardIndex,yieldBonus_,position.poolIds)](src/managers/LiquidityManager.sol#L601-L611)
		- [strategyManager.withdrawFromStrategy(strategyId,0,strategyRewards,posOwner,yieldBonus_)](src/managers/LiquidityManager.sol#L620-L626)
		- [self.dao.accrueRevenue(self.paymentAsset,netFees,leverageFee)](src/libs/VirtualPool.sol#L440-L444)
	- [(capital,strategyRewards) = _removeOverlappingCapital(positionId_,position.supplied,amount_,position.strategyRewardIndex,latestStrategyRewardIndex,position.poolIds)](src/managers/LiquidityManager.sol#L759-L769)
		- [(capital,rewards) = VirtualPool._withdrawLiquidity(poolId0,positionId_,supplied_,amount_,strategyRewardIndex_,latestStrategyRewardIndex_,poolIds_)](src/managers/LiquidityManager.sol#L1058-L1066)
		- [self.dao.accrueRevenue(self.paymentAsset,netFees,leverageFee)](src/libs/VirtualPool.sol#L440-L444)
	State variables written after the call(s):
	- [position.supplied = capital - amount_](src/managers/LiquidityManager.sol#L775)
	[LiquidityManager._positions](src/managers/LiquidityManager.sol#L84) can be used in cross function reentrancies:
	- [LiquidityManager._positions](src/managers/LiquidityManager.sol#L84)
	- [LiquidityManager._takeInterests(uint256,address,uint256)](src/managers/LiquidityManager.sol#L574-L634)
	- [LiquidityManager.positionInfo(uint256)](src/managers/LiquidityManager.sol#L240-L245)
	- [LiquidityManager.positionInfos(uint256[])](src/managers/LiquidityManager.sol#L276-L294)
	- [LiquidityManager.positions(uint256)](src/managers/LiquidityManager.sol#L229-L233)
	- [position.strategyRewardIndex = latestStrategyRewardIndex](src/managers/LiquidityManager.sol#L776)
	[LiquidityManager._positions](src/managers/LiquidityManager.sol#L84) can be used in cross function reentrancies:
	- [LiquidityManager._positions](src/managers/LiquidityManager.sol#L84)
	- [LiquidityManager._takeInterests(uint256,address,uint256)](src/managers/LiquidityManager.sol#L574-L634)
	- [LiquidityManager.positionInfo(uint256)](src/managers/LiquidityManager.sol#L240-L245)
	- [LiquidityManager.positionInfos(uint256[])](src/managers/LiquidityManager.sol#L276-L294)
	- [LiquidityManager.positions(uint256)](src/managers/LiquidityManager.sol#L229-L233)

src/managers/LiquidityManager.sol#L733-L801


 - [ ] ID-44
Reentrancy in [EcclesiaDao._unlock(EcclesiaDao.LockedBalance,uint256)](src/misc/EcclesiaDao.sol#L386-L423):
	External calls:
	- [staking.withdrawTokenDao(msg.sender,address(this),withdrawAmount_)](src/misc/EcclesiaDao.sol#L407-L411)
	State variables written after the call(s):
	- [userLock.staking -= withdrawAmount_](src/misc/EcclesiaDao.sol#L418)
	[EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136) can be used in cross function reentrancies:
	- [EcclesiaDao._deposit(uint256,uint256)](src/misc/EcclesiaDao.sol#L254-L300)
	- [EcclesiaDao.createLock(uint256,uint256)](src/misc/EcclesiaDao.sol#L309-L329)
	- [EcclesiaDao.harvest(address[])](src/misc/EcclesiaDao.sol#L563-L614)
	- [EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136)

src/misc/EcclesiaDao.sol#L386-L423


 - [ ] ID-45
Reentrancy in [Staking.initializeFarming(IStaking.BonusLevel[])](src/rewards/Staking.sol#L111-L125):
	External calls:
	- [farming.deposit(CAMPAIGN_ID,1)](src/rewards/Staking.sol#L122)
	State variables written after the call(s):
	- [farmingInitialized = true](src/rewards/Staking.sol#L124)
	[Staking.farmingInitialized](src/rewards/Staking.sol#L64) can be used in cross function reentrancies:
	- [Staking.farmingInitialized](src/rewards/Staking.sol#L64)
	- [Staking.initializeFarming(IStaking.BonusLevel[])](src/rewards/Staking.sol#L111-L125)
	- [Staking.isFarmingInitialized()](src/rewards/Staking.sol#L68-L73)

src/rewards/Staking.sol#L111-L125


 - [ ] ID-46
Reentrancy in [EcclesiaDao._deposit(uint256,uint256)](src/misc/EcclesiaDao.sol#L254-L300):
	External calls:
	- [staking.depositDao(msg.sender,toStake)](src/misc/EcclesiaDao.sol#L287)
	State variables written after the call(s):
	- [userLock.userStakingIndex = stakingIndex](src/misc/EcclesiaDao.sol#L296)
	[EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136) can be used in cross function reentrancies:
	- [EcclesiaDao._deposit(uint256,uint256)](src/misc/EcclesiaDao.sol#L254-L300)
	- [EcclesiaDao.createLock(uint256,uint256)](src/misc/EcclesiaDao.sol#L309-L329)
	- [EcclesiaDao.harvest(address[])](src/misc/EcclesiaDao.sol#L563-L614)
	- [EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136)
	- [userLock.staking += toStake](src/misc/EcclesiaDao.sol#L297)
	[EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136) can be used in cross function reentrancies:
	- [EcclesiaDao._deposit(uint256,uint256)](src/misc/EcclesiaDao.sol#L254-L300)
	- [EcclesiaDao.createLock(uint256,uint256)](src/misc/EcclesiaDao.sol#L309-L329)
	- [EcclesiaDao.harvest(address[])](src/misc/EcclesiaDao.sol#L563-L614)
	- [EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136)

src/misc/EcclesiaDao.sol#L254-L300


 - [ ] ID-47
Reentrancy in [FarmingRange.updateRewardInfo(uint256,uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L797-L880):
	External calls:
	- [_transferFromWithAllowance(campaign.rewardToken,_diff,_campaignID)](src/rewards/FarmingRange.sol#L833-L837)
		- [this.attemptTransfer(_rewardToken,rewardManager,address(this),_amount)](src/rewards/FarmingRange.sol#L1180-L1199)
		- [rewardManager.call(abi.encodeWithSignature(resetAllowance(uint256),_campaignID))](src/rewards/FarmingRange.sol#L1188-L1193)
	State variables written after the call(s):
	- [campaign.totalRewards -= _initialNextTotal - _nextTotal](src/rewards/FarmingRange.sol#L865)
	[FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86) can be used in cross function reentrancies:
	- [FarmingRange._deposit(uint256,uint256,bool,uint256)](src/rewards/FarmingRange.sol#L248-L279)
	- [FarmingRange._pendingReward(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L1209-L1242)
	- [FarmingRange._updateCampaign(uint256)](src/rewards/FarmingRange.sol#L1249-L1321)
	- [FarmingRange.addCampaignInfo(IFarmingRange.AssetType,uint256,IERC20,IERC20,uint256)](src/rewards/FarmingRange.sol#L697-L730)
	- [FarmingRange.addRewardInfo(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L733-L776)
	- [FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86)
	- [FarmingRange.campaignInfoLen()](src/rewards/FarmingRange.sol#L984-L986)
	- [FarmingRange.deposit(uint256,uint256)](src/rewards/FarmingRange.sol#L282-L298)
	- [FarmingRange.depositWithPermit(uint256,uint256,bool,uint256,uint8,bytes32,bytes32)](src/rewards/FarmingRange.sol#L399-L420)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [FarmingRange.removeLastRewardInfo(uint256)](src/rewards/FarmingRange.sol#L938-L974)
	- [FarmingRange.updateRewardInfo(uint256,uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L797-L880)
	- [campaign.totalRewards = campaign.totalRewards - _diff](src/rewards/FarmingRange.sol#L869-L871)
	[FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86) can be used in cross function reentrancies:
	- [FarmingRange._deposit(uint256,uint256,bool,uint256)](src/rewards/FarmingRange.sol#L248-L279)
	- [FarmingRange._pendingReward(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L1209-L1242)
	- [FarmingRange._updateCampaign(uint256)](src/rewards/FarmingRange.sol#L1249-L1321)
	- [FarmingRange.addCampaignInfo(IFarmingRange.AssetType,uint256,IERC20,IERC20,uint256)](src/rewards/FarmingRange.sol#L697-L730)
	- [FarmingRange.addRewardInfo(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L733-L776)
	- [FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86)
	- [FarmingRange.campaignInfoLen()](src/rewards/FarmingRange.sol#L984-L986)
	- [FarmingRange.deposit(uint256,uint256)](src/rewards/FarmingRange.sol#L282-L298)
	- [FarmingRange.depositWithPermit(uint256,uint256,bool,uint256,uint8,bytes32,bytes32)](src/rewards/FarmingRange.sol#L399-L420)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [FarmingRange.removeLastRewardInfo(uint256)](src/rewards/FarmingRange.sol#L938-L974)
	- [FarmingRange.updateRewardInfo(uint256,uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L797-L880)
	- [campaign.totalRewards = campaign.totalRewards + _diff](src/rewards/FarmingRange.sol#L869-L871)
	[FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86) can be used in cross function reentrancies:
	- [FarmingRange._deposit(uint256,uint256,bool,uint256)](src/rewards/FarmingRange.sol#L248-L279)
	- [FarmingRange._pendingReward(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L1209-L1242)
	- [FarmingRange._updateCampaign(uint256)](src/rewards/FarmingRange.sol#L1249-L1321)
	- [FarmingRange.addCampaignInfo(IFarmingRange.AssetType,uint256,IERC20,IERC20,uint256)](src/rewards/FarmingRange.sol#L697-L730)
	- [FarmingRange.addRewardInfo(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L733-L776)
	- [FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86)
	- [FarmingRange.campaignInfoLen()](src/rewards/FarmingRange.sol#L984-L986)
	- [FarmingRange.deposit(uint256,uint256)](src/rewards/FarmingRange.sol#L282-L298)
	- [FarmingRange.depositWithPermit(uint256,uint256,bool,uint256,uint8,bytes32,bytes32)](src/rewards/FarmingRange.sol#L399-L420)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [FarmingRange.removeLastRewardInfo(uint256)](src/rewards/FarmingRange.sol#L938-L974)
	- [FarmingRange.updateRewardInfo(uint256,uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L797-L880)

src/rewards/FarmingRange.sol#L797-L880


 - [ ] ID-48
Reentrancy in [EcclesiaDao.earlyWithdraw(uint256)](src/misc/EcclesiaDao.sol#L455-L500):
	External calls:
	- [_unlock(_lock,amount_)](src/misc/EcclesiaDao.sol#L471)
		- [staking.withdrawTokenDao(msg.sender,address(this),withdrawAmount_)](src/misc/EcclesiaDao.sol#L407-L411)
	State variables written after the call(s):
	- [_burn(address(this),_amountBurn)](src/misc/EcclesiaDao.sol#L490)
		- [balanceOf[account] -= amount](src/tokens/ERC20.sol#L53)
	[ERC20.balanceOf](src/tokens/ERC20.sol#L18) can be used in cross function reentrancies:
	- [ERC20._burn(address,uint256)](src/tokens/ERC20.sol#L46-L59)
	- [ERC20._mint(address,uint256)](src/tokens/ERC20.sol#L35-L44)
	- [ERC20.balanceOf](src/tokens/ERC20.sol#L18)
	- [harvest(revenueTokens)](src/misc/EcclesiaDao.sol#L483)
		- [userLock.userStakingIndex = stakingIndex](src/misc/EcclesiaDao.sol#L589)
		- [userLock.userRedisIndex = redistributeIndex](src/misc/EcclesiaDao.sol#L591)
	[EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136) can be used in cross function reentrancies:
	- [EcclesiaDao._deposit(uint256,uint256)](src/misc/EcclesiaDao.sol#L254-L300)
	- [EcclesiaDao.createLock(uint256,uint256)](src/misc/EcclesiaDao.sol#L309-L329)
	- [EcclesiaDao.harvest(address[])](src/misc/EcclesiaDao.sol#L563-L614)
	- [EcclesiaDao.locks](src/misc/EcclesiaDao.sol#L136)
	- [_burn(address(this),_amountBurn)](src/misc/EcclesiaDao.sol#L490)
		- [totalSupply -= amount](src/tokens/ERC20.sol#L54)
	[ERC20.totalSupply](src/tokens/ERC20.sol#L17) can be used in cross function reentrancies:
	- [ERC20._burn(address,uint256)](src/tokens/ERC20.sol#L46-L59)
	- [ERC20._mint(address,uint256)](src/tokens/ERC20.sol#L35-L44)
	- [ERC20.totalSupply](src/tokens/ERC20.sol#L17)

src/misc/EcclesiaDao.sol#L455-L500


 - [ ] ID-49
Reentrancy in [LiquidityManager.addLiquidity(uint256,uint256,bool)](src/managers/LiquidityManager.sol#L502-L564):
	External calls:
	- [_takeInterests(positionId_,positionToken.ownerOf(positionId_),0)](src/managers/LiquidityManager.sol#L519-L523)
		- [(newUserCapital,strategyRewards) = VirtualPool._takePoolInterests(position.poolIds[i],positionId_,coverRewardsBeneficiary_,position.supplied,position.strategyRewardIndex,latestStrategyRewardIndex,yieldBonus_,position.poolIds)](src/managers/LiquidityManager.sol#L601-L611)
		- [strategyManager.withdrawFromStrategy(strategyId,0,strategyRewards,posOwner,yieldBonus_)](src/managers/LiquidityManager.sol#L620-L626)
		- [self.dao.accrueRevenue(self.paymentAsset,netFees,leverageFee)](src/libs/VirtualPool.sol#L440-L444)
	- [strategyManager.depositWrappedToStrategy(strategyId)](src/managers/LiquidityManager.sol#L548)
	- [strategyManager.depositToStrategy(strategyId,amount)](src/managers/LiquidityManager.sol#L559)
	State variables written after the call(s):
	- [position.supplied += amountUnderlying](src/managers/LiquidityManager.sol#L563)
	[LiquidityManager._positions](src/managers/LiquidityManager.sol#L84) can be used in cross function reentrancies:
	- [LiquidityManager._positions](src/managers/LiquidityManager.sol#L84)
	- [LiquidityManager._takeInterests(uint256,address,uint256)](src/managers/LiquidityManager.sol#L574-L634)
	- [LiquidityManager.positionInfo(uint256)](src/managers/LiquidityManager.sol#L240-L245)
	- [LiquidityManager.positionInfos(uint256[])](src/managers/LiquidityManager.sol#L276-L294)
	- [LiquidityManager.positions(uint256)](src/managers/LiquidityManager.sol#L229-L233)

src/managers/LiquidityManager.sol#L502-L564


 - [ ] ID-50
Reentrancy in [Staking.deposit(uint256)](src/rewards/Staking.sol#L128-L168):
	External calls:
	- [harvestFarming()](src/rewards/Staking.sol#L135)
		- [farming.withdraw(CAMPAIGN_ID,0)](src/rewards/Staking.sol#L281)
	State variables written after the call(s):
	- [userInfo[msg.sender].shares += _userNewShares](src/rewards/Staking.sol#L151)
	[Staking.userInfo](src/rewards/Staking.sol#L61) can be used in cross function reentrancies:
	- [Staking.checkUserBlock()](src/rewards/Staking.sol#L75-L81)
	- [Staking.deposit(uint256)](src/rewards/Staking.sol#L128-L168)
	- [Staking.emergencyWithdraw(address)](src/rewards/Staking.sol#L251-L277)
	- [Staking.userInfo](src/rewards/Staking.sol#L61)
	- [Staking.withdraw(address,uint256)](src/rewards/Staking.sol#L201-L230)

src/rewards/Staking.sol#L128-L168


 - [ ] ID-51
Reentrancy in [LiquidityManager.commitRemoveLiquidity(uint256)](src/managers/LiquidityManager.sol#L678-L693):
	External calls:
	- [_takeInterests(positionId_,positionToken.ownerOf(positionId_),0)](src/managers/LiquidityManager.sol#L685-L689)
		- [(newUserCapital,strategyRewards) = VirtualPool._takePoolInterests(position.poolIds[i],positionId_,coverRewardsBeneficiary_,position.supplied,position.strategyRewardIndex,latestStrategyRewardIndex,yieldBonus_,position.poolIds)](src/managers/LiquidityManager.sol#L601-L611)
		- [strategyManager.withdrawFromStrategy(strategyId,0,strategyRewards,posOwner,yieldBonus_)](src/managers/LiquidityManager.sol#L620-L626)
		- [self.dao.accrueRevenue(self.paymentAsset,netFees,leverageFee)](src/libs/VirtualPool.sol#L440-L444)
	State variables written after the call(s):
	- [position.commitWithdrawalTimestamp = block.timestamp](src/managers/LiquidityManager.sol#L692)
	[LiquidityManager._positions](src/managers/LiquidityManager.sol#L84) can be used in cross function reentrancies:
	- [LiquidityManager._positions](src/managers/LiquidityManager.sol#L84)
	- [LiquidityManager._takeInterests(uint256,address,uint256)](src/managers/LiquidityManager.sol#L574-L634)
	- [LiquidityManager.positionInfo(uint256)](src/managers/LiquidityManager.sol#L240-L245)
	- [LiquidityManager.positionInfos(uint256[])](src/managers/LiquidityManager.sol#L276-L294)
	- [LiquidityManager.positions(uint256)](src/managers/LiquidityManager.sol#L229-L233)

src/managers/LiquidityManager.sol#L678-L693


 - [ ] ID-52
Reentrancy in [FarmingRange.emergencyWithdrawNft(uint256[],uint256[][])](src/rewards/FarmingRange.sol#L583-L631):
	External calls:
	- [coverToken.transferFrom(address(this),msg.sender,tokenId)](src/rewards/FarmingRange.sol#L608)
	- [positionToken.transferFrom(address(this),msg.sender,tokenId)](src/rewards/FarmingRange.sol#L617-L621)
	State variables written after the call(s):
	- [campaign.totalStaked = campaign.totalStaked - _amount](src/rewards/FarmingRange.sol#L603)
	[FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86) can be used in cross function reentrancies:
	- [FarmingRange._deposit(uint256,uint256,bool,uint256)](src/rewards/FarmingRange.sol#L248-L279)
	- [FarmingRange._pendingReward(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L1209-L1242)
	- [FarmingRange._updateCampaign(uint256)](src/rewards/FarmingRange.sol#L1249-L1321)
	- [FarmingRange.addCampaignInfo(IFarmingRange.AssetType,uint256,IERC20,IERC20,uint256)](src/rewards/FarmingRange.sol#L697-L730)
	- [FarmingRange.addRewardInfo(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L733-L776)
	- [FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86)
	- [FarmingRange.campaignInfoLen()](src/rewards/FarmingRange.sol#L984-L986)
	- [FarmingRange.deposit(uint256,uint256)](src/rewards/FarmingRange.sol#L282-L298)
	- [FarmingRange.depositWithPermit(uint256,uint256,bool,uint256,uint8,bytes32,bytes32)](src/rewards/FarmingRange.sol#L399-L420)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [FarmingRange.removeLastRewardInfo(uint256)](src/rewards/FarmingRange.sol#L938-L974)
	- [FarmingRange.updateRewardInfo(uint256,uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L797-L880)
	- [campaignTokenDeposits[campaignID][tokenId] = address(0)](src/rewards/FarmingRange.sol#L599)
	[FarmingRange.campaignTokenDeposits](src/rewards/FarmingRange.sol#L102-L103) can be used in cross function reentrancies:
	- [FarmingRange.campaignTokenDeposits](src/rewards/FarmingRange.sol#L102-L103)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [delete coverIdToCampaignId[tokenId]](src/rewards/FarmingRange.sol#L610)
	[FarmingRange.coverIdToCampaignId](src/rewards/FarmingRange.sol#L100-L101) can be used in cross function reentrancies:
	- [FarmingRange.coverIdToCampaignId](src/rewards/FarmingRange.sol#L100-L101)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [nbLpTokenCampaigns[tokenId] --](src/rewards/FarmingRange.sol#L614)
	[FarmingRange.nbLpTokenCampaigns](src/rewards/FarmingRange.sol#L98-L99) can be used in cross function reentrancies:
	- [FarmingRange.nbLpTokenCampaigns](src/rewards/FarmingRange.sol#L98-L99)
	- [user.amount = 0](src/rewards/FarmingRange.sol#L604)
	[FarmingRange.userInfoNft](src/rewards/FarmingRange.sol#L92-L93) can be used in cross function reentrancies:
	- [FarmingRange._deposit(uint256,uint256,bool,uint256)](src/rewards/FarmingRange.sol#L248-L279)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [FarmingRange.userInfoNft](src/rewards/FarmingRange.sol#L92-L93)
	- [user.rewardDebt = 0](src/rewards/FarmingRange.sol#L605)
	[FarmingRange.userInfoNft](src/rewards/FarmingRange.sol#L92-L93) can be used in cross function reentrancies:
	- [FarmingRange._deposit(uint256,uint256,bool,uint256)](src/rewards/FarmingRange.sol#L248-L279)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [FarmingRange.userInfoNft](src/rewards/FarmingRange.sol#L92-L93)

src/rewards/FarmingRange.sol#L583-L631


 - [ ] ID-53
Reentrancy in [FarmingRange.depositCoverNft(uint256,uint256)](src/rewards/FarmingRange.sol#L348-L396):
	External calls:
	- [coverToken.transferFrom(msg.sender,address(this),_tokenId)](src/rewards/FarmingRange.sol#L355)
	State variables written after the call(s):
	- [_deposit(_campaignID,amount,true,_tokenId)](src/rewards/FarmingRange.sol#L392)
		- [campaign.totalStaked = campaign.totalStaked + _amount](src/rewards/FarmingRange.sol#L273)
		- [campaign.lastRewardBlock = block.number](src/rewards/FarmingRange.sol#L1290)
		- [campaign.lastRewardBlock = _rewardInfo[_i_scope_0].endBlock](src/rewards/FarmingRange.sol#L1308)
		- [campaign.lastRewardBlock = block.number](src/rewards/FarmingRange.sol#L1310)
		- [campaign.accRewardPerShare = campaign.accRewardPerShare + ((_multiplier * _rewardInfo[_i_scope_0].rewardPerBlock * 1e20) / campaign.totalStaked)](src/rewards/FarmingRange.sol#L1312-L1315)
	[FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86) can be used in cross function reentrancies:
	- [FarmingRange._deposit(uint256,uint256,bool,uint256)](src/rewards/FarmingRange.sol#L248-L279)
	- [FarmingRange._pendingReward(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L1209-L1242)
	- [FarmingRange._updateCampaign(uint256)](src/rewards/FarmingRange.sol#L1249-L1321)
	- [FarmingRange.addCampaignInfo(IFarmingRange.AssetType,uint256,IERC20,IERC20,uint256)](src/rewards/FarmingRange.sol#L697-L730)
	- [FarmingRange.addRewardInfo(uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L733-L776)
	- [FarmingRange.campaignInfo](src/rewards/FarmingRange.sol#L86)
	- [FarmingRange.campaignInfoLen()](src/rewards/FarmingRange.sol#L984-L986)
	- [FarmingRange.deposit(uint256,uint256)](src/rewards/FarmingRange.sol#L282-L298)
	- [FarmingRange.depositWithPermit(uint256,uint256,bool,uint256,uint8,bytes32,bytes32)](src/rewards/FarmingRange.sol#L399-L420)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [FarmingRange.removeLastRewardInfo(uint256)](src/rewards/FarmingRange.sol#L938-L974)
	- [FarmingRange.updateRewardInfo(uint256,uint256,uint256,uint256)](src/rewards/FarmingRange.sol#L797-L880)

src/rewards/FarmingRange.sol#L348-L396


 - [ ] ID-54
Reentrancy in [Staking.withdraw(address,uint256)](src/rewards/Staking.sol#L201-L230):
	External calls:
	- [harvestFarming()](src/rewards/Staking.sol#L212)
		- [farming.withdraw(CAMPAIGN_ID,0)](src/rewards/Staking.sol#L281)
	State variables written after the call(s):
	- [userInfo[msg.sender].shares -= _sharesAmount](src/rewards/Staking.sol#L220)
	[Staking.userInfo](src/rewards/Staking.sol#L61) can be used in cross function reentrancies:
	- [Staking.checkUserBlock()](src/rewards/Staking.sol#L75-L81)
	- [Staking.deposit(uint256)](src/rewards/Staking.sol#L128-L168)
	- [Staking.emergencyWithdraw(address)](src/rewards/Staking.sol#L251-L277)
	- [Staking.userInfo](src/rewards/Staking.sol#L61)
	- [Staking.withdraw(address,uint256)](src/rewards/Staking.sol#L201-L230)

src/rewards/Staking.sol#L201-L230


 - [ ] ID-55
Reentrancy in [FarmingRange.forceExpiredCoverWithdrawal(uint256)](src/rewards/FarmingRange.sol#L653-L674):
	External calls:
	- [coverToken.transferFrom(address(this),owner,_tokenId)](src/rewards/FarmingRange.sol#L668)
	State variables written after the call(s):
	- [campaignTokenDeposits[campaignID][_tokenId] = address(0)](src/rewards/FarmingRange.sol#L672)
	[FarmingRange.campaignTokenDeposits](src/rewards/FarmingRange.sol#L102-L103) can be used in cross function reentrancies:
	- [FarmingRange.campaignTokenDeposits](src/rewards/FarmingRange.sol#L102-L103)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)
	- [delete coverIdToCampaignId[_tokenId]](src/rewards/FarmingRange.sol#L673)
	[FarmingRange.coverIdToCampaignId](src/rewards/FarmingRange.sol#L100-L101) can be used in cross function reentrancies:
	- [FarmingRange.coverIdToCampaignId](src/rewards/FarmingRange.sol#L100-L101)
	- [FarmingRange.freezeExpiredCoverRewards(uint256)](src/rewards/FarmingRange.sol#L635-L651)

src/rewards/FarmingRange.sol#L653-L674


## tautology
Impact: Medium
Confidence: High
 - [ ] ID-56
[Staking.amountToYieldBonus(uint256)](src/rewards/Staking.sol#L394-L409) contains a tautology or contradiction:
	- [0 <= i](src/rewards/Staking.sol#L402)

src/rewards/Staking.sol#L394-L409


## unchecked-lowlevel
Impact: Medium
Confidence: Medium
 - [ ] ID-57
[FarmingRange._transferFromWithAllowance(IERC20,uint256,uint256)](src/rewards/FarmingRange.sol#L1175-L1200) ignores return value by [rewardManager.call(abi.encodeWithSignature(resetAllowance(uint256),_campaignID))](src/rewards/FarmingRange.sol#L1188-L1193)

src/rewards/FarmingRange.sol#L1175-L1200


## uninitialized-local
Impact: Medium
Confidence: Medium
 - [ ] ID-58
[FarmingRange._updateCampaign(uint256)._amount](src/rewards/FarmingRange.sol#L1260) is a local variable never initialized

src/rewards/FarmingRange.sol#L1260


 - [ ] ID-59
[LiquidityManager._takeInterests(uint256,address,uint256).strategyRewards](src/managers/LiquidityManager.sol#L593) is a local variable never initialized

src/managers/LiquidityManager.sol#L593


 - [ ] ID-60
[EcclesiaDao.harvest(address[]).tokenRewardsRay](src/misc/EcclesiaDao.sol#L567) is a local variable never initialized

src/misc/EcclesiaDao.sol#L567


 - [ ] ID-61
[ClaimManager.claimsByAccount(address).nbOfClaims](src/managers/ClaimManager.sol#L457) is a local variable never initialized

src/managers/ClaimManager.sol#L457


 - [ ] ID-62
[ClaimManager.claimsByAccount(address).index](src/managers/ClaimManager.sol#L464) is a local variable never initialized

src/managers/ClaimManager.sol#L464


 - [ ] ID-63
[AthenaDataProvider.positionInfo(ILiquidityManager.Position,uint256).info](src/misc/AthenaDataProvider.sol#L37) is a local variable never initialized

src/misc/AthenaDataProvider.sol#L37


 - [ ] ID-64
[FarmingRange.depositLpNft(uint256[],uint256).hasRequiredPools](src/rewards/FarmingRange.sol#L326) is a local variable never initialized

src/rewards/FarmingRange.sol#L326


 - [ ] ID-65
[ClaimManager._checkCanUploadEvidence(uint256).contribution](src/managers/ClaimManager.sol#L625) is a local variable never initialized

src/managers/ClaimManager.sol#L625


 - [ ] ID-66
[VirtualPool._payRewardsAndFees(uint64,uint256,address,uint256,uint256).leverageFee](src/libs/VirtualPool.sol#L409) is a local variable never initialized

src/libs/VirtualPool.sol#L409


 - [ ] ID-67
[LiquidityManager._takeInterests(uint256,address,uint256).newUserCapital](src/managers/LiquidityManager.sol#L592) is a local variable never initialized

src/managers/LiquidityManager.sol#L592


