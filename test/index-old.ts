import { baseContext } from "./context";
// Test suites
import { testDeployProtocol } from "./contracts-old/deployProtocol.test";
import { testLiquidityProvider } from "./contracts-old/liquidityProvider.test";
import { testPolicyTaker } from "./contracts-old/policyTaker.test";
import { testPoliciesTaker } from "./contracts-old/policiesTaker.test";
import { testPolicyView } from "./contracts-old/policyView.test";
import { testClaims } from "./contracts-old/claims.test";
import { testRewardsWithoutClaim } from "./contracts-old/rewardsWithoutClaim.test";
import { testRewardsWithClaims } from "./contracts-old/rewardsWithClaims.test";
import { testTakeInterestWithoutClaim } from "./contracts-old/takeInterestWithoutClaim.test";
import { testTakeInterestWithClaim } from "./contracts-old/takeInterestWithClaim.test";
import { testWithdrawLiquidity1ProtocolWithoutClaim } from "./contracts-old/withdrawLiquidity1ProtocolWithoutClaim.test";
import { testWithdrawAllWithoutClaim } from "./contracts-old/withdrawAllWithoutClaim.test";
import { testWithdrawAllWithClaim } from "./contracts-old/withdrawAllWithClaim.test";
import { testResolveClaim } from "./contracts-old/resolveClaim.test";
import { testExpiredPoliciesWithCanceling } from "./contracts-old/expiredPoliciesWithCanceling.test";
import { testExpiredPoliciesWithoutCanceling } from "./contracts-old/expiredPoliciesWithoutCanceling.test";
import { testOngoingCoveragePolicies } from "./contracts-old/ongoingCoveragePolicies.test";
import { testStakingPolicy } from "./contracts-old/stakingPolicy.test";
import { testStakingGeneralPool } from "./contracts-old/stakingGeneralPool.test";
import { testUpdateCover } from "./contracts-old/updateCover.test";
import { testProtocolsView } from "./contracts-old/protocolsView.test";
// @bw these test we not run by previous testing cmd - keep / del ?
import { testClaimsView } from "./contracts-old/claimsView.test";
import { testPremiumRewards } from "./contracts-old/premiumRewards.test";
import { testProtocolPool } from "./contracts-old/protocolPool.test";
import { testThaoPremiumLeftError } from "./contracts-old/thaoPremiumLeftError.test";
import { testFinance } from "./contracts-old/finance.test";

baseContext("Functionnal tests", function () {
  testDeployProtocol();
  testLiquidityProvider();
  testPolicyTaker();
  testPoliciesTaker();
  testClaims();
  testRewardsWithoutClaim();
  testRewardsWithClaims();
  testTakeInterestWithoutClaim();
  testTakeInterestWithClaim();
  testWithdrawLiquidity1ProtocolWithoutClaim();
  testWithdrawAllWithoutClaim();
  testWithdrawAllWithClaim();
  testResolveClaim();
  testExpiredPoliciesWithCanceling();
  testExpiredPoliciesWithoutCanceling();
  testOngoingCoveragePolicies();
  testStakingPolicy();
  testStakingGeneralPool();
  testUpdateCover();
  //
  // testPremiumRewards();
  testProtocolPool();
  testThaoPremiumLeftError();
  testFinance();
  // Views
  testPolicyView();
  testProtocolsView();
  testClaimsView();
});
