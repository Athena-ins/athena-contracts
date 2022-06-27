type Claim = {
  protocolId: number;
  amount: number;
  ratio: number;
  timestamp: number;
};

type Position = {
  depositAmount: number;
  protocolIds: number[];
  protocolAmounts: number[];
  lastActionTimestamp: number;
};

type ProtocolPool = {
  id: number;
  totalCapital: number;
  claims: Claim[];
  intersectingAmounts: { [keys: number]: number };
  positionManager: { [keys: string]: Position };
  premiumSpent: number;
};

const positionManager: { [keys: string]: Position } = {};
const protocolPools: ProtocolPool[] = [];

function initProtocols(_numberProtocols: number) {
  for (let i = 0; i < _numberProtocols; i++)
    protocolPools.push({
      id: i,
      claims: [],
      intersectingAmounts: {},
      positionManager: {},
      totalCapital: 0,
      premiumSpent: 0,
    });
}

function deposit(
  _owner: string,
  _depositAmount: number,
  _protocolIds: number[],
  _protocolAmounts: number[]
) {
  for (let i = 0; i < _protocolIds.length; i++) {
    const __currentProtocolId = _protocolIds[i];
    const __amount = _protocolAmounts[i];
    const __protocolPool = protocolPools[__currentProtocolId];

    for (let j = 0; j < _protocolIds.length; j++) {
      if (j !== i) {
        const __value = __protocolPool.intersectingAmounts[_protocolIds[j]];
        if (!__value)
          __protocolPool.intersectingAmounts[_protocolIds[j]] = __amount;
        else
          __protocolPool.intersectingAmounts[_protocolIds[j]] =
            __value + __amount;
      }
    }
    __protocolPool.positionManager[_owner] = {
      depositAmount: __amount,
      protocolIds: _protocolIds,
      protocolAmounts: _protocolAmounts,
      lastActionTimestamp: 0,
    };

    __protocolPool.totalCapital += _protocolAmounts[i];
  }
}

function setPremiumSpent(_protocolId: number, _amount: number) {
  protocolPools[_protocolId].premiumSpent = _amount;
}

//_claimAmount:
////claim amount
//_totalCapital:
////capital de pool P en moment de claim dans la même pool P
function getClaimAmountRatio(_claimAmount: number, _totalCapital: number) {
  return _claimAmount / _totalCapital;
}

function startClaim(_protocolId: number, _amount: number, _timestamp: number) {
  const __compatifProtocolIds = Object.keys(
    protocolPools[_protocolId].intersectingAmounts
  ).map((e) => Number(e));
  __compatifProtocolIds.push(_protocolId);

  for (const __protocolId of __compatifProtocolIds) {
    protocolPools[__protocolId].claims.push({
      protocolId: _protocolId,
      amount: _amount,
      ratio: getClaimAmountRatio(
        _amount,
        protocolPools[_protocolId].totalCapital
      ),
      timestamp: _timestamp,
    });
  }
}

//Thao@NOTE: on peut garder le montant commun entre deux pools avec une condition:
////si pid1 <= pid2 ==>> pid1.map(pid2 => montantCommun)
////sinon ==>> pid2.map(pid1 => montantCommun)

//_intersecAmount:
////le montant en commun entre deux protocols
//_claimRatio: le ratio entre le montant claim et totalCapital d'un même pool src
//amountToRemove:
////Le montant à enlever d'intersecAmount des deux protocols
////et de totalCapital de protocol cible
function amountToRemoveFromIntersecAndCapital(
  _intersecAmount: number,
  _claimRatio: number
) {
  return _intersecAmount * _claimRatio;
}

function ratioBetweenDepositAndIntersec(
  _depositAmount: number,
  __intersecAmount: number
) {
  return _depositAmount / __intersecAmount;
}

function amountToRemoveFromDeposit(
  _amountToRemoveFromIntersec: number,
  _depositRatio: number
) {
  return _amountToRemoveFromIntersec * _depositRatio;
}

//TODO
function updateDepositAmount(_owner: string, _protocolId: number) {
  const __protocolPool = protocolPools[_protocolId];
  const __position = __protocolPool.positionManager[_owner];
  let __totalCapital = __protocolPool.totalCapital;
  let __depositAmount = __position.depositAmount;
  for (let i = 0; i < __protocolPool.claims.length; i++) {
    const __claim = __protocolPool.claims[i];
    if (__position.protocolIds.includes(__claim.protocolId)) {
      const __intersecAmount =
        __protocolPool.intersectingAmounts[__claim.protocolId];
      const __amountToRemoveFromIntersecAndCapital =
        amountToRemoveFromIntersecAndCapital(__intersecAmount, __claim.ratio);
      const __ratioBetweenDepositAndIntersec = ratioBetweenDepositAndIntersec(
        __depositAmount,
        __intersecAmount
      );
      const __amountToRemoveFromDeposit = amountToRemoveFromDeposit(
        __amountToRemoveFromIntersecAndCapital,
        __ratioBetweenDepositAndIntersec
      );

      console.log("__totalCapital:", __totalCapital);
      console.log(
        "__intersecAmount:",
        __protocolPool.intersectingAmounts[__claim.protocolId]
      );
      console.log("__depositAmount:", __depositAmount);
      console.log("__claim.ratio:", __claim.ratio);
      console.log("__intersecAmount:", __intersecAmount);
      console.log(
        "__amountToRemoveFromIntersecAndCapital:",
        __amountToRemoveFromIntersecAndCapital
      );
      console.log(
        "__ratioBetweenDepositAndIntersec:",
        __ratioBetweenDepositAndIntersec
      );
      console.log("__amountToRemoveFromDeposit:", __amountToRemoveFromDeposit);

      __totalCapital -= __amountToRemoveFromIntersecAndCapital;
      __protocolPool.intersectingAmounts[__claim.protocolId] -=
        __amountToRemoveFromIntersecAndCapital;
      __depositAmount -= __amountToRemoveFromDeposit;
      console.log("__totalCapital:", __totalCapital);
      console.log(
        "__intersecAmount:",
        __protocolPool.intersectingAmounts[__claim.protocolId]
      );
      console.log("__depositAmount:", __depositAmount);
      console.log();
    }
  }
}

initProtocols(4);

deposit("user0", 2000, [0], [2000]);
deposit("user1", 4000, [0, 1], [4000, 4000]);
deposit("user2", 2000, [1, 2], [2000, 2000]);
deposit("user3", 8000, [0, 1, 3], [8000, 8000, 8000]);

// setPremiumSpent(0, 800);
// setPremiumSpent(1, 200);
// setPremiumSpent(2, 200);
// setPremiumSpent(3, 400);

startClaim(1, 700, 0);
// startClaim(1, 700, 1);
startClaim(3, 400, 1);

// console.log(JSON.stringify(protocolPools, null, 2), "\n");

updateDepositAmount("user1", 0);

//NOTE: co the tao 1 bien de luu action time xa nhat trong qua khu de biet co the xoa cai claim nao di

//neu claim dans Px thi chi tru storage capital trong Px
//Py co claim cua Px thi chi dung de tinh toan memory capital de lay premium spent

//actualiser can phai tinh toan voi tat ca claim.

//su dung bitmap de chua claim, key = claim.timestamp

//sau khi tru di tat ca cho 1 claim thi tinh toan lai liquidityIndex moi va chay den gap thang claim khac. trc khi traiter claim phai rewards trc

//amountToRemoveFromDeposit(pn) = claim_x(p1) / capital_x(p1) * deposit(pn)

//Warn: trc khi claim, phai actualiser ==>> lam the nao de intégrer claim vao system tick (co cach nao de dua tren lastUpdateTimestamp ko?)
