type Claim = {
  poolId: number;
  amount: number;
  ratio: number;
  timestamp: number;
};

type Position = {
  depositAmount: number;
  poolIds: number[];
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
  _poolIds: number[],
  _protocolAmounts: number[]
) {
  for (let i = 0; i < _poolIds.length; i++) {
    const __currentPoolId = _poolIds[i];
    const __amount = _protocolAmounts[i];
    const __protocolPool = protocolPools[__currentPoolId];

    for (let j = 0; j < _poolIds.length; j++) {
      if (j !== i) {
        const __value = __protocolPool.intersectingAmounts[_poolIds[j]];
        if (!__value)
          __protocolPool.intersectingAmounts[_poolIds[j]] = __amount;
        else
          __protocolPool.intersectingAmounts[_poolIds[j]] = __value + __amount;
      }
    }
    __protocolPool.positionManager[_owner] = {
      depositAmount: __amount,
      poolIds: _poolIds,
      protocolAmounts: _protocolAmounts,
      lastActionTimestamp: 0,
    };

    __protocolPool.totalCapital += _protocolAmounts[i];
  }
}

function setPremiumSpent(_poolId: number, _amount: number) {
  protocolPools[_poolId].premiumSpent = _amount;
}

//_claimAmount:
////claim amount
//_totalCapital:
////capital de pool P en moment de claim dans la même pool P
function getClaimAmountRatio(_claimAmount: number, _totalCapital: number) {
  return _claimAmount / _totalCapital;
}

function startClaim(_poolId: number, _amount: number, _timestamp: number) {
  const __compatifPoolIds = Object.keys(
    protocolPools[_poolId].intersectingAmounts
  ).map((e) => Number(e));
  __compatifPoolIds.push(_poolId);

  for (const __poolId of __compatifPoolIds) {
    protocolPools[__poolId].claims.push({
      poolId: _poolId,
      amount: _amount,
      ratio: getClaimAmountRatio(_amount, protocolPools[_poolId].totalCapital),
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
function updateDepositAmount(_owner: string, _poolId: number) {
  const __protocolPool = protocolPools[_poolId];
  const __position = __protocolPool.positionManager[_owner];
  let __totalCapital = __protocolPool.totalCapital;
  let __depositAmount = __position.depositAmount;
  for (let i = 0; i < __protocolPool.claims.length; i++) {
    const __claim = __protocolPool.claims[i];
    if (__position.poolIds.includes(__claim.poolId)) {
      const __intersecAmount =
        __protocolPool.intersectingAmounts[__claim.poolId];
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
        __protocolPool.intersectingAmounts[__claim.poolId]
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
      __protocolPool.intersectingAmounts[__claim.poolId] -=
        __amountToRemoveFromIntersecAndCapital;
      __depositAmount -= __amountToRemoveFromDeposit;
      console.log("__totalCapital:", __totalCapital);
      console.log(
        "__intersecAmount:",
        __protocolPool.intersectingAmounts[__claim.poolId]
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

//su dung bitmap de chua claim, key = claim.timestamp

//amountToRemoveFromDeposit(pn) = claim_x(p1) / capital_x(p1) * deposit(pn)

//actualiser can phai tinh toan voi tat ca claim.
//tinh capital va premiumSpent roi nho vao cho LP doc va tinh toan

//sau khi tru di tat ca cho 1 claim thi tinh toan lai liquidityIndex moi va chay den gap thang claim khac. trc khi traiter claim phai rewards trc

//dans Px, claim Py, Pz, ... est enregistré pour actualiser plus tard.
//si claim viens de Px, actualiser avant de traiter claim mais ne l'enregistrer pas dans sys ticks, ne l'enregistrer que dans ticks claim pour LP peut calculer sa récompense

//khong the add claim vao ticks dc vi claim co thoi gian cu the con ticks thi co time giao dong. Can luu claim o 1 cho khac va thuc hien trong actualizing
