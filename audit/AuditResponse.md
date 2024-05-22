## [H-01] Cover premium rewards can be lost High

Status: fixed

## [M-01] First leveraged pool is extra penalized Medium

Status: acknowledged

The leverage risk fee is meant to be applied on a per pool basis and not on a per extra pool basis. This is because when using leverage in two pools this creates liquidity dependency for both pools. The fee evolution is more abrupt but this is by design.

## [M-02] User can spam covers to DoS cover usage Medium

Status: fixed

## [M-03] Users are missing out on Aave v3 rewards Medium

Status: fixed

note for auditors: Integrating individual computation of rewards per user would be too time consuming at the moment and rewards may be negligible. We have implemented two privileged functions in the `StrategyManager` to avoid the loss of extra rewards. If the amounts become worthwhile, we will review how they can be redistributed to users.

## [L-01] Possible silent overflow Low

Status: fixed

## [L-02] Avoid using transfer Low

Status: fixed

## [L-03] Consider using OppenZeppelin's safeTransfer Low

Status: fixed

## [L-04] Avoid using tx.origin Low

Status: acknowledged

We recognize that `tx.origin` is meant to be used with care and only when needed. The whitelist feature is meant as a temporary measure that may even be removed before the first production deployment. Additionally, the `StrategyManager` is going to be heavily reformed soon in order to include new strategies in a modular manner. The new version will not have any whitelist feature. Adding the original caller as a parameter would then cause the need for a new `LiquidityManager` deployment or induce unnecessary gas costs. For these reasons we believe it's best to leave the current usage of `tx.origin` that we deem safe to use in the current (temporary) setting.
