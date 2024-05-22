## [H-01] Cover premium rewards can be lost High

Status: 

## [M-01] First leveraged pool is extra penalized Medium

Status: acknowledged

The leverage risk fee is meant to be applied on a per pool basis and not on a per extra pool basis. This is because when using leverage in only two pools this creates risk for both pools. The fee evolution is more abrupt but this is by design.

## [M-02] User can spam covers to DoS cover usage Medium

Status: 

## [M-03] Users are missing out on Aave v3 rewards Medium

Status: partially fixed


## [L-01] Possible silent overflow Low

Status: fixed


## [L-02] Avoid using transfer Low

Status: fixed

## [L-03] Consider using OppenZeppelin's safeTransfer Low

Status: fixed

## [L-04] Avoid using tx.origin Low 

Status: acknowledged

We recognize that tx.origin is meant to be used with care and only when needed. The whitelist feature is meant as a temporary measure that may even be removed before the first production deployment. Additionally, the StrategyManager is going to be heavily reformed soon in order to include new strategies in a modular manner. The new version will not have any whitelist feature. Adding the original caller as a parameter would then cause the need for a new LiquidityManager deployment or induce unnecessary gas costs. For these reasons we believe it best to leave the current usage of tx.origin that we believe to be safe to use in the current setting. 



///////////////////////////
///////////////////////////
///////////////////////////


# [H-01] Cover premium rewards can be lost
 
### Description
Premiums paid by the cover holders are periodically distributed to the liquidity providers. This is done on all
calls affecting the pool utilization.
It goes down to a function VirtualPool::_refreshSlot0 which has all the logic for updating the
current tick and new utilization and updating the cover premium rewards.
The way it works is that it calculates the current tick and then checks which covers are expiring between the
last tick checked and the new current tick:

```js
286: if (isInitialized) {
287: (slot0, utilization, premiumRate) = self
288: ._crossingInitializedTick(slot0, nextTick);
289: }
290:
291: // Remove parsed tick size from remaining time to current timestamp
292: remaining -= secondsToNextTickEnd;
293: secondsParsed = secondsToNextTickEnd;
294: slot0.tick = nextTick + 1;
295: } else {
// ...
303: }
304:
305: slot0.liquidityIndex += PoolMath.computeLiquidityIndex(
306: utilization,
307: premiumRate,
308: secondsParsed
309: );
```

The issue is that the liquidity index is computed with the new utilization and premium rate. Hence any last
rewards from the closed cover will be lost. The most extreme case would be a cover that's opened and
closed between when _refreshSlot0 is called, then all the premiums from that position would be lost.
Recommendations
Consider calculating the liquidity index before crossing an initialized tick as well.

# [M-01] First leveraged pool is extra penalized
 
### Description
To handle the increased risk from liquidity providers providing the same liquidity in multiple pools the
protocol has a leverage fee that is taken on the profits made, this only kicks in when a liquidity provider
provides liquidity in more than one pool:

VirtualPool::_payRewardsAndFees:

414: uint256 leverageFee;
415: if (1 < nbPools_) {
416: // The risk fee is only applied when using leverage
417: leverageFee =
418: (rewards_ * (self.leverageFeePerPool * nbPools_)) /
419: HUNDRED_PERCENT;
420: } // ...
The issue here is that the first "additional" pool will get unfairly penalized. If you stake in one pool you get 0
leverageFee applied. If you stake in two pools you get 2*leverageFee applied. While you stake in a
third pool you only get one additional leverageFee for this pool (3*leverageFee). I.e. the second pool
costs 2 leverage fees, compared to the rest.
Recommendations

Consider just taking the leverageFee for the additional pools:
- (rewards_ * (self.leverageFeePerPool * nbPools_)) /
+ (rewards_ * (self.leverageFeePerPool * nbPools_ - 1)) /


# [M-02] User can spam covers to DoS cover usage
 
### Description
Cover expiry is tracked per tick so that when covers expire the rate, seconds per tick and utilization can be
recalculated. Whenever an action happens that involves a change in any of these values these covers need
to be tracked. 

This happens in VirtualPool::_crossingInitializedTick:

1113: uint256[] memory coverIds = self.ticks[tick_];
1114:
1115: uint256 coveredCapitalToRemove;
1116:
1117: uint256 nbCovers = coverIds.length;
1118: for (uint256 i; i < nbCovers; i++) {
1119: // Add all the size of all covers in the tick
1120: coveredCapitalToRemove += self.covers[coverIds[i]].coverAmount;
1121: }

Here each cover is looped over and its cover amount is added to the total removed which will later be used
to update premiumRate, slot0_.secondsPerTick, and utilization.
The issue is that a user can open any number of covers for dust amounts and fill up a tick so that this loop
can use more gas than is available in a block. Thus causing a denial of service to all interactions involving
opening, updating or withdrawing a position or opening/updating or claiming a cover.
Hence even though this would be expensive and complicated for the attacker in terms of gas and
complicated to perform (as they would need to spread the creation of covers out across multiple blocks),
the effect would be a total DoS of the LiquidityManager.

Note, there is a way for the admin to purgeExpiredCoversUpTo but this only handles if there are too
many covers spread across ticks. This would also be impossible to use if the total covers within one tick
would be too many.

Recommendations
Consider just tracking the aggregate amounts that are expiring per tick instead of each cover. This would
remove the need to loop over the covers and thus the possibility for DoS.

# [M-03] Users are missing out on Aave v3 rewards
 
### Description
Aave can hand out extra rewards
See here
Currently in StrategyManager there is no way to claim these rewards. This is in itself not a problem as a
protocol can through an Aave gov vote get rights to claim on behalf of their contracts. But once that is
done, there is no way for these to be redistributed back to the users staking.
Hence a user is disincentivized from moving their staking position from Aave to Athena since they will be
losing out on their rewards.
Recommendations
Consider implementing a way to re-add the rewards from Aave to the users staking in Aave through
StrategyManager.

[L-01] Possible silent overflow
When calculating the last tick for a cover this is the code in VirtualPool::_registerCover is used:
666: uint32 lastTick = self.slot0.tick +
667; uint32(durationInSeconds / newSecondsPerTick);
Here there is a possibility for overflow if durationInSeconds / newSecondsPerTick is larger than
type(uint32).max.
This could happen if a user opens a cover with a very high premium, meaning they want a cover for a very
long time. Then instead of getting a very long cover they would get a much lower tick. Possibly even already
expired.
Now, this would require someone to open a very long cover which is very unlikely.
Consider validating that durationInSeconds / newSecondsPerTick is not bigger than
type(uint32).max and then reverting.

[L-02] Avoid using transfer
In StrategyManager.sol there's a way for the owner to rescue funds in the form of ether:
511: function rescueTokens(
512: address token,
513: address to,
514: uint256 amount
515: ) external onlyOwner {
516: if (token == address(0)) {
517: payable(to).transfer(amount);
518: } else {
payable.transfer only forwards a fixed 2300 gas for the call. This could cause smart contract wallets or
DAO treasury contracts to run out of gas since they might do logic in their receive functions.
Since it's recommended to use multisigs for handling any protocol funds this could force the owner to
rescue funds to a less secure account.
Consider using low-level call.value(amount) with the corresponding result check or using the
OpenZeppelin Address.sendValue. Also, it is recommended to add a nonReentrant modifier as it
protects from reentrancy attacks.

[L-03] Consider using OpenZeppelin's
safeTransfer
In StrategyManager.sol there's also a way for the owner to rescue funds in the form of IERC20 tokens:
511: function rescueTokens(
512: address token,
513: address to,
514: uint256 amount
515: ) external onlyOwner {
// ...
518: } else {
519: IERC20(token).transfer(to, amount);
520: }
521: }
There are a lot of weird tokens out there. Some tokens don't revert on failure and thus require the sender to
check the returned bool value. While some tokens also don't return a bool value.
This could cause tokens to be rescued to not be rescued or the transfers to not work.
Further reading: https://github.com/d-xo/weird-erc20
Consider using OpenZeppelins SafeTransfer library.

[L-04] Avoid using tx.origin
In StrategyManager.sol tx.origin is used to validate if an account is whitelisted:
103: modifier onlyWhiteListedLiquidityProviders() {
104: if (
105: // @dev using tx origin since the contract is called by the
liquidity manager
106: isWhitelistEnabled && !whiteListedLiquidityProviders[tx.origin]
107: ) revert OnlyWhitelistCanDepositLiquidity();
108: _;
109: }
Using tx.origin should be avoided for a number of reasons:
https://swcregistry.io/docs/SWC-115/ https://consensys.github.io/smart-contract-best-
practices/development-recommendations/solidity-specific/tx-origin/
https://docs.soliditylang.org/en/develop/security-considerations.html#tx-origin
It's also warned that it might be deprecated in the future.
Consider adding the sender as a parameter to these calls so msg.sender can be verified instead.