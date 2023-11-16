import { baseContext } from "./context";
import { beforeEach } from "mocha";
import { resetFork } from "./helpers/HardhatHelper";
// Test suites
import { testDeployProtocol } from "./contracts/deployProtocol.test";
import { testLiquidityProvider } from "./contracts/liquidityProvider.test";
import { testPolicyTaker } from "./contracts/policyTaker.test";
import { testPoliciesTaker } from "./contracts/policiesTaker.test";
import { testPolicyView } from "./contracts/policyView.test";
import { testClaims } from "./contracts/claims.test";
import { testRewardsWithoutClaim } from "./contracts/rewardsWithoutClaim.test";
import { testRewardsWithClaims } from "./contracts/rewardsWithClaims.test";
import { testTakeInterestWithoutClaim } from "./contracts/takeInterestWithoutClaim.test";
import { testTakeInterestWithClaim } from "./contracts/takeInterestWithClaim.test";
import { testWithdrawLiquidity1ProtocolWithoutClaim } from "./contracts/withdrawLiquidity1ProtocolWithoutClaim.test";
import { testWithdrawAllWithoutClaim } from "./contracts/withdrawAllWithoutClaim.test";
import { testWithdrawAllWithClaim } from "./contracts/withdrawAllWithClaim.test";
import { testResolveClaim } from "./contracts/resolveClaim.test";
import { testExpiredPoliciesWithCanceling } from "./contracts/expiredPoliciesWithCanceling.test";
import { testExpiredPoliciesWithoutCanceling } from "./contracts/expiredPoliciesWithoutCanceling.test";
import { testOngoingCoveragePolicies } from "./contracts/ongoingCoveragePolicies.test";
import { testStakingPolicy } from "./contracts/stakingPolicy.test";
import { testStakingGeneralPool } from "./contracts/stakingGeneralPool.test";
import { testUpdateCover } from "./contracts/updateCover.test";
import { testProtocolsView } from "./contracts/protocolsView.test";

baseContext("Functionnal tests", function () {
  beforeEach(async function () {
    this.retries(2);
    await resetFork();
  });

  describe("Core contracts", function () {
    testDeployProtocol();
    testLiquidityProvider();
    testPolicyTaker();
    testPoliciesTaker();
    testPolicyView();
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
    testProtocolsView();
  });

  describe.skip("Views", function () {
    testClaims();
  });
});
