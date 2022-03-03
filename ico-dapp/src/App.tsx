import {
  useCall,
  useContractFunction,
  useEtherBalance,
  useEthers,
  useNotifications,
  useTokenAllowance,
  useTokenBalance,
  Mainnet,
  Rinkeby,
} from "@usedapp/core";
import ConnectButton from "./Connectbutton";
import { Button, notificationContent, NotificationElement } from "./Components";
import { createRef, useEffect, useState } from "react";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { BigNumber, Contract, ethers } from "ethers";
import abi from "./contractAbi.json";

const SCALER = 100000;
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const wei = BigNumber.from(10).pow(18);

function App() {
  const { account, library } = useEthers();
  const USDT =
    library?.network.chainId === 1
      ? "0xdac17f958d2ee523a2206206994597c13d831ec7"
      : library?.network.chainId === 4
      ? "0xD92E713d051C37EbB2561803a3b5FBAbc4962431"
      : "0xD92E713d051C37EbB2561803a3b5FBAbc4962431";
  // ; //USDT
  const ATHENA_ICO_CONTRACT_ADDRESS =
    library?.network.chainId === 1
      ? "0xb66657B12A0eCcB31E677036f532A491430EB055"
      : library?.network.chainId === 4
      ? "0xb66657B12A0eCcB31E677036f532A491430EB055"
      : "0xb66657B12A0eCcB31E677036f532A491430EB055";
  const { notifications, addNotification } = useNotifications();
  const [loadingApprove, setLoadingApprove] = useState(false);
  const [notifHistory, setnotifHistory] = useState<
    { text: string; date: number }[]
  >([]);

  const { state, send, resetState } = useContractFunction(
    new ethers.Contract(ATHENA_ICO_CONTRACT_ADDRESS, abi),
    "prebuy"
  );
  const { value: ethPrice, error: ethPriceError } =
    useCall({
      contract: new Contract(ATHENA_ICO_CONTRACT_ADDRESS, abi),
      method: "getLatestPrice",
      args: [],
    }) ?? {};
  const [isEth, setIsEth] = useState(true);
  const [amount, setAmount] = useState("0");
  const tokenBalance = useTokenBalance(USDT, account);
  const tokenAllowance = useTokenAllowance(
    USDT,
    account,
    ATHENA_ICO_CONTRACT_ADDRESS
  );
  const etherBalance = useEtherBalance(account);

  const usdtContract = new ethers.Contract(USDT, [
    {
      inputs: [
        { internalType: "address", name: "owner", type: "address" },
        { internalType: "address", name: "spender", type: "address" },
      ],
      name: "allowance",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "spender", type: "address" },
        { internalType: "uint256", name: "amount", type: "uint256" },
      ],
      name: "approve",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function",
    },
  ]);

  const handleApprove = async (e: any) => {
    e.preventDefault();
    if (!library?.getSigner()) return;

    try {
      setLoadingApprove(true);
      const send = await usdtContract
        .connect(library?.getSigner())
        .approve(
          ATHENA_ICO_CONTRACT_ADDRESS,
          ethers.utils.parseUnits(amount, 6)
        );
      const receipt = await send.wait();
      console.log("RECEIPT", receipt);
      addNotification(receipt);
    } catch (error) {
      setLoadingApprove(false);
    }
  };

  useEffect(() => {
    if (state.status)
      setnotifHistory((prev) => [
        ...prev,
        {
          date: Date.now(),
          text:
            state.errorMessage || state.receipt?.transactionHash
              ? "Tx : " +
                (library?.network.chainId === 1
                  ? Mainnet
                  : Rinkeby
                ).getExplorerTransactionLink(
                  state.receipt?.transactionHash || "0x00"
                )
              : "Undefined",
        },
      ]);
  }, [state]);

  const handleMint = async (e: any) => {
    try {
      e.preventDefault();
      await send(
        ethers.utils.parseUnits(amount, isEth ? 18 : 6),
        isEth ? ETH : USDT,
        account,
        {
          value: isEth ? ethers.utils.parseEther(amount) : undefined,
        }
      );

      // resetState();
      // addNotification({
      //   chainId: state.chainId || 0,
      //   notification: {
      //     type: state.errorMessage,
      //     submittedAt: Date.now(),
      //     address: "Denied",
      //   },
      // });
    } catch (error) {
      resetState();
      console.error(error);
    }
  };

  return (
    <article>
      <header className="animated fadeIn wow">
        <h1 className="highlight double push-bottom">
          <span className="highlight-word underline-only no-underline">
            Public sale
          </span>{" "}
          <span className="highlight-word underline-only">round 1</span>
        </h1>
      </header>
      <div className="bg-primary card card-sales">
        <ConnectButton
          className="btn btn-secondary"
          style={{ padding: "2px 8px", justifyContent: "space-around" }}
        />
      </div>
      <form className="bg-primary card card-sales">
        <div className="corner">
          <select
            className="form-control"
            data-first-option="show"
            onChange={(e) => setIsEth(e.target.value === "eth")}
          >
            <option value="eth">ETH</option>
            <option value="usdt">USDT</option>
          </select>
          <div className="row-flex bottom-md mini-push-top">
            <div className="col-xs-12 col-md-8">
              <input
                name="amount"
                className="form-control"
                onChange={(e) => setAmount(e.target.value || "0")}
                value={amount}
              />
            </div>
            <div className="col-xs-12 col-md-4">
              <p className="bal">
                Balance:{" "}
                <span>
                  {parseFloat(
                    formatUnits(
                      (isEth ? etherBalance : tokenBalance) || "0",
                      isEth ? 18 : 6
                    )
                  ).toFixed(2)}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="corner mini-push-bottom">
          <div className="badge badge-secondary">
            <span className="aten">ATEN</span>
          </div>
          <div className="row-flex bottom-md mini-push-top">
            <div className="col-xs-12 col-md-8">
              <input
                name="result"
                readOnly
                className="form-control"
                value={
                  amount && ethPrice && isEth
                    ? parseFloat(
                        formatUnits(
                          BigNumber.from(
                            parseInt((Number(amount) * SCALER).toString())
                          )
                            .mul(wei)
                            .div(SCALER)
                            .div(ethPrice[0])
                            .mul(wei)
                            .mul(1000)
                            .div(35),
                          18
                        )
                      ).toFixed(4)
                    : amount && ethPrice && !isEth
                    ? parseFloat(
                        formatUnits(
                          BigNumber.from(
                            parseInt((Number(amount) * SCALER).toString())
                          )
                            .mul(10 ** 6)
                            .div(SCALER)
                            .mul(1000)
                            .div(35),
                          6
                        )
                      ).toFixed(4)
                    : "0"
                }
              />
            </div>
            <div className="col-xs-12 col-md-4">
              <p className="bal">
                Balance: <span>0.00</span>
              </p>
            </div>
          </div>
        </div>
        <div className="collapse" id="aten-info">
          <div className="label label-ghost">1 ATEN = $0.035</div>
        </div>
        {!isEth &&
        tokenAllowance?.lt(
          BigNumber.from(parseInt((Number(amount) * SCALER).toString()))
            .mul(10 ** 6)
            .div(SCALER)
        ) ? (
          <Button
            className="btn btn-block btn-info"
            type="submit"
            onClick={handleApprove}
            disabled={loadingApprove}
          >
            APPROVE USDT
          </Button>
        ) : (
          <Button
            className="btn btn-block btn-secondary"
            type="submit"
            onClick={handleMint}
            disabled={
              !account ||
              !amount ||
              !(isEth
                ? etherBalance?.gte(parseUnits(amount.toString()) || false)
                : tokenBalance?.gte(parseUnits(amount.toString(), 6)) || false)
            }
          >
            Purchase ATEN
          </Button>
        )}
      </form>
      {notifications.map((notification) => {
        if ("transaction" in notification)
          return (
            <NotificationElement
              key={notification.id}
              icon={notificationContent[notification.type].icon}
              title={notificationContent[notification.type].title}
              transaction={notification.transaction}
              date={Date.now()}
            />
          );
        else
          return (
            <NotificationElement
              key={notification.id}
              icon={notificationContent[notification.type].icon}
              title={notificationContent[notification.type].title}
              date={Date.now()}
            />
          );
      })}
      <h3>History</h3>
      <div
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          position: "absolute",
        }}
      >
        {notifHistory.map((notification, i) => (
          <div key={i}>
            <p>Le : {new Date(notification.date).toLocaleDateString()}</p>
            <p>
              {notification.text.includes("https://") ? (
                <a href={notification.text.slice(4)}>{"Tx link to explorer"}</a>
              ) : (
                notification.text
              )}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export default App;
