import { EcclesiaDao_tokenToVotes } from "./tokenToVotes.test";
import { EcclesiaDao_votesToTokens } from "./votesToTokens.test";
import { EcclesiaDao_createLock } from "./createLock.test";
import { EcclesiaDao_increaseLockAmount } from "./increaseLockAmount.test";
import { EcclesiaDao_increaseUnlockTime } from "./increaseUnlockTime.test";
import { EcclesiaDao_setBreaker } from "./setBreaker.test";
import { EcclesiaDao_withdraw } from "./withdraw.test";
import { EcclesiaDao_earlyWithdraw } from "./earlyWithdraw.test";
import { EcclesiaDao_syncStaking } from "./syncStaking.test";
import { EcclesiaDao_accrueRevenue } from "./accrueRevenue.test";
import { EcclesiaDao_harvest } from "./harvest.test";
import { EcclesiaDao_setEarlyWithdrawConfig } from "./setEarlyWithdrawConfig.test";
import { EcclesiaDao_withdrawETH } from "./withdrawETH.test";

export async function EcclesiaDaoTests() {
  EcclesiaDao_tokenToVotes();
  EcclesiaDao_votesToTokens();
  EcclesiaDao_createLock();
  EcclesiaDao_increaseLockAmount();
  EcclesiaDao_increaseUnlockTime();
  EcclesiaDao_setBreaker();
  EcclesiaDao_withdraw();
  EcclesiaDao_earlyWithdraw();
  EcclesiaDao_syncStaking();
  EcclesiaDao_accrueRevenue();
  EcclesiaDao_harvest();
  EcclesiaDao_setEarlyWithdrawConfig();
  EcclesiaDao_withdrawETH();
}
