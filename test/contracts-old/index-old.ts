import { baseContext } from "../context";
// Test suites
import { testDeployProtocol } from "./deployProtocol.test";
import { testLiquidityProvider } from "./liquidityProvider.test";
import { testPolicyTaker } from "./policyTaker.test";
import { testPoliciesTaker } from "./policiesTaker.test";
import { testPolicyView } from "./policyView.test";
import { testClaims } from "./claims.test";
import { testRewardsWithoutClaim } from "./rewardsWithoutClaim.test";
import { testRewardsWithClaims } from "./rewardsWithClaims.test";
import { testTakeInterestWithoutClaim } from "./takeInterestWithoutClaim.test";
import { testTakeInterestWithClaim } from "./takeInterestWithClaim.test";
import { testWithdrawLiquidity1ProtocolWithoutClaim } from "./withdrawLiquidity1ProtocolWithoutClaim.test";
import { testWithdrawAllWithoutClaim } from "./withdrawAllWithoutClaim.test";
import { testWithdrawAllWithClaim } from "./withdrawAllWithClaim.test";
import { testResolveClaim } from "./resolveClaim.test";
import { testExpiredPoliciesWithCanceling } from "./expiredPoliciesWithCanceling.test";
import { testExpiredPoliciesWithoutCanceling } from "./expiredPoliciesWithoutCanceling.test";
import { testOngoingCoveragePolicies } from "./ongoingCoveragePolicies.test";
import { testStakingPolicy } from "./stakingPolicy.test";
import { testStakingGeneralPool } from "./stakingGeneralPool.test";
import { testUpdateCover } from "./updateCover.test";
import { testProtocolsView } from "./protocolsView.test";
// @bw these test we not run by previous testing cmd - keep / del ?
import { testClaimsView } from "./claimsView.test";
import { testPremiumRewards } from "./premiumRewards.test";
import { testProtocolPool } from "./protocolPool.test";
import { testThaoPremiumLeftError } from "./thaoPremiumLeftError.test";
import { testFinance } from "./finance.test";

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
