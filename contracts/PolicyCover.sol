// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPolicyCover.sol";

import "hardhat/console.sol";

contract PolicyCover is IPolicyCover, ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Ticker {
        uint256 time;
        int256 emissionRate;
        uint256 liquidity;
    }
    struct Policy {
        uint256 time;
        uint256 capital;
        uint256 premium;
        address owner;
    }
    uint256 public lastUpdateTime;
    // uint256 public rewardPerTokenStored;
    uint256 public precision = 10000;
    address public underlyingAsset;
    Ticker public actualTicker;
    mapping(uint256 => Ticker) public policyTickers;
    uint256[] public initializedTickers;

    Policy[] public policies;
    uint256 internal accruedInterest;

    uint256 public totalShares;
    uint256 public premiumSupply;
    uint256 public totalInsured;
    mapping(address => uint256) private _balances;

    uint256 internal _uOptimal = 7500; // 75 / 100 * 10000
    uint256 internal _r0 = 10000; // 1 * 10000
    uint256 internal _rSlope1 = 1200; // 1.2 * 10000
    uint256 internal _rSlope2 = 1100; // 1.1 * 10000
    uint256 internal _power_slope2 = 100;

    uint256 internal constant RAY = 1e27;
    uint256 internal constant halfRAY = RAY / 2;

    uint256 internal availableCapital = 100000;

    constructor(address _underlyingAsset) {
        underlyingAsset = _underlyingAsset;
        uint256 day = secondsToDay(block.timestamp);
        initializedTickers.push(day);
        policyTickers[day] = Ticker(day - 1, 0, 0);
    }

    modifier updateState(address account) {
        // rewardPerTokenStored = rewardPerToken();
        accruedInterest += getAccruedInterest();
        lastUpdateTime = block.timestamp;
        updateTickers([Ticker(0, 0, 0), Ticker(0, 0, 0)]);

        // New rate, next date policy expire ?

        // rewards[account] = earned(account);
        // userRewardPerTokenPaid[account] = rewardPerTokenStored;
        _;
    }

    /**
        Si U < Uoptimal : 	P = R0 + Rslope1*(U - Uoptimal)
        Si U >= Uoptimal : 	P = R0 + Rslope1 + Rslope2 * (U - Uoptimal)^(Power_slope2)
     */
    function getRate(uint256 _addedPolicy) public view returns (uint256) {
        // returns actual rate for insurance
        uint256 _uRate = getUtilisationRate(_addedPolicy);
        // *precision (10000)
        console.log("Utilisation rate:", _uRate);
        if(_uRate < _uOptimal){
            return _r0 + _rSlope1 * (_uRate / _uOptimal);
        }
        else {
            return _r0 + _rSlope1 + _rSlope2 * (_uRate - _uOptimal) / (10000 - _uOptimal) / 100;
        }
    }

    function getUtilisationRate(uint256 _addedPolicy) public view returns (uint256) {
        // returns actual usage rate on capital insured / capital provided for insurance
        if(availableCapital == 0){
            return 0;
        }
        return (totalInsured + _addedPolicy) * precision / availableCapital; // at precision
    }

    function getAccruedInterest()
        public
        view
        returns (uint256 _accruedInterests)
    {
        uint256 day = secondsToDay(block.timestamp);
        uint256 lastDay = secondsToDay(lastUpdateTime);
        for (uint256 index = 0; index < policies.length; index++) {
            //@Dev fix rate when policy expired !
            if (
                duration(
                    policies[index].premium,
                    policies[index].capital,
                    getRate(0)
                ) +
                    policies[index].time >
                day
            ) {
                _accruedInterests +=
                    (policies[index].premium * (day - lastDay) * getRate(0)) /
                    precision;
            } else if (
                duration(
                    policies[index].premium,
                    policies[index].capital,
                    getRate(0)
                ) +
                    policies[index].time <=
                day
            ) {
                _accruedInterests +=
                    (policies[index].premium *
                        (policies[index].time - lastDay) *
                        getRate(0)) /
                    precision;
                //remove policy
            }
        }

        return accruedInterest;
    }

    function buyPolicy(uint256 _amount, uint256 _capitalInsured) override external {
        IERC20(underlyingAsset).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        premiumSupply += _amount;
        totalInsured += _capitalInsured;
        uint256 _duration = duration(_amount, _capitalInsured, getRate(_capitalInsured));
        console.log("Duration : ", _duration);
        console.log("Time day : ", secondsToDay(block.timestamp));
        updateTickers(
            [
                Ticker({
                    time: secondsToDay(block.timestamp),
                    emissionRate: 1,
                    liquidity: 1
                }),
                Ticker({
                    time: secondsToDay(block.timestamp),
                    emissionRate: -1,
                    liquidity: 1
                })
            ]
        );
    }

    function balanceOfPremiums(address _account)
        external
        view
        returns (uint256)
    {
        return _balances[_account];
    }

    function secondsToDay(uint256 _seconds) public pure returns (uint256) {
        return _seconds / (60 * 60 * 24);
    }

    function duration(
        uint256 premium,
        uint256 capital,
        uint256 rate
    ) public view returns (uint256) {
        return (premium * 100 * precision * 365) / (capital * (rate));
    }

    function roundDown(uint256 _numerator, uint256 _denominator)
        public
        pure
        returns (uint256)
    {
        return _numerator / _denominator;
    }

    /**
     * @dev Multiplies two ray, rounding half up to the nearest ray
     * @param a Ray
     * @param b Ray
     * @return The result of a*b, in ray
     **/
    function rayMul(uint256 a, uint256 b) public pure returns (uint256) {
        if (a == 0 || b == 0) {
            return 0;
        }

        require(a <= (type(uint256).max - halfRAY) / b, "Overflow rayMul");

        return (a * b + halfRAY) / RAY;
    }

    function updateTickers(Ticker[2] memory _addTickers) internal {
        uint256 _time = secondsToDay(block.timestamp);
        console.log("Time Update Tickers : ", _time);

        uint256 _lastTicker = 0;
        uint256 lastTickerTime = policyTickers[initializedTickers[0]].time;
        if (actualTicker.time < lastTickerTime && _time < lastTickerTime) {
            actualTicker.liquidity +=
                // safe convert because total emission rate is >= 0
                uint256(actualTicker.emissionRate) *
                (_time - actualTicker.time);
        }
        if (_addTickers.length > 0 && _addTickers[0].time > 0) {
            initializedTickers.push((_addTickers[0].time));
            initializedTickers.push((_addTickers[1].time));
            policyTickers[(_addTickers[0].time)] = _addTickers[0];
            policyTickers[(_addTickers[1].time)] = _addTickers[1];
            console.log(
                "Add Tickers 1: ",
                policyTickers[(_addTickers[0].time)].time
            );
            console.logInt(policyTickers[(_addTickers[0].time)].emissionRate);
            console.logInt(policyTickers[(_addTickers[1].time)].emissionRate);
            // actualTicker.emissionRate += _addTickers[0].emissionRate;
            // actualTicker.time = _addTickers[0].time;
            //HANDLE UPDATE Existing TICKER TIME DATA

            //@dev : TODO : might be gas interesting to sort offchain and check onchain
            // sortTickers();
            // console.log("Add Tickers init : ", initializedTickers[0]);
            // console.log("Add Tickers init 2: ", initializedTickers[1]);
            // console.log("Add Tickers init 2: ", initializedTickers[2]);
        }
        Ticker memory elementTicker = policyTickers[initializedTickers[0]];
        uint32 index = 0;
        bool crossedTicker = false;
        Ticker memory previousTicker;
        while (elementTicker.time <= _time) {
            crossedTicker = true;
            console.log("While loop : ", index);
            actualTicker.liquidity +=
                uint256(actualTicker.emissionRate) *
                (elementTicker.time -
                    (
                        (index > 0 && previousTicker.time > 0)
                            ? previousTicker.time
                            : actualTicker.time
                    ));
            actualTicker.emissionRate += elementTicker.emissionRate;
            console.log("While loop ER : ");
            console.logInt(actualTicker.emissionRate);
            _lastTicker = elementTicker.time;
            previousTicker = elementTicker;
            actualTicker.time = elementTicker.time;
            index++;
            elementTicker = policyTickers[initializedTickers[index]];
        }
        policyTickers[_time] = actualTicker;
        if (crossedTicker) {
            sortTickers();
            removeTickers(index);
        }
        console.log("Last ticker size : ", initializedTickers.length);
        for (uint256 j = 0; j < initializedTickers.length; j++) {
            console.log(
                "Ticker %d %d : ",
                initializedTickers[j],
                policyTickers[initializedTickers[j]].time
            );
        }
        if (_lastTicker != 0 && _lastTicker < _time) {
            actualTicker.liquidity +=
                uint256(actualTicker.emissionRate) *
                (_time - _lastTicker);
        }
    }

    function removeTickers(uint256 _amount)
        internal
        returns (uint256[] storage)
    {
        require(
            _amount > 0 && _amount < initializedTickers.length,
            "Wrong remove ticker _amount"
        );
        console.log("Remove tickers : ", _amount);
        // remove previousTicker from storage
        for (uint256 i = 0; i < initializedTickers.length - _amount; i++) {
            delete policyTickers[initializedTickers[i]];
            initializedTickers[i] = initializedTickers[i + _amount];
        }
        for (uint256 index = 0; index < _amount; index++) {
            initializedTickers.pop();
        }
        delete initializedTickers[initializedTickers.length - 1];
        return initializedTickers;
    }

    function sortTickers() public {
        quickSort(
            initializedTickers,
            int256(0),
            int256(initializedTickers.length - 1)
        );
    }

    function quickSort(
        uint256[] storage arr,
        int256 left,
        int256 right
    ) internal {
        int256 i = left;
        int256 j = right;
        if (i == j) return;
        uint256 pivot = arr[uint256(left + (right - left) / 2)];
        while (i <= j) {
            while (arr[uint256(i)] < pivot) i++;
            while (pivot < arr[uint256(j)]) j--;
            if (i <= j) {
                (arr[uint256(i)], arr[uint256(j)]) = (
                    arr[uint256(j)],
                    arr[uint256(i)]
                );
                i++;
                j--;
            }
        }
        if (left < j) quickSort(arr, left, j);
        if (i < right) quickSort(arr, i, right);
    }

    function _stake(address _account, uint256 _amount)
        internal
        updateState(_account)
        nonReentrant
    {
        totalShares += _amount;
        _balances[_account] += _amount;
    }

    function _unstake(address _account, uint256 _amount)
        internal
        updateState(_account)
        nonReentrant
    {
        totalShares -= _amount;
        _balances[_account] -= _amount;
    }

    function _withdraw(address _account, uint256 _amount)
        internal
        updateState(_account)
        nonReentrant
    {
        require(_balances[_account] >= _amount, "Not enough balance");
        totalShares -= _amount;
        _balances[_account] -= _amount;
        IERC20(underlyingAsset).safeTransfer(_account, _amount);
    }
}
