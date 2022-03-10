import {
  getExplorerTransactionLink,
  useCall,
  useEtherBalance,
  useTokenAllowance,
  useTokenBalance,
} from "@usedapp/core";
import ConnectButton from "./Connectbutton";
import { toast } from "react-toastify";
import { Button } from "./Components";
import { Modal } from "react-bootstrap";
import { useEffect, useState } from "react";
import { formatEther, formatUnits, parseUnits } from "ethers/lib/utils";
import { BigNumber, Contract, ethers } from "ethers";
import abi from "./contractAbi.json";
import { useWallet } from "./useWallet";
const SCALER = 10000000;
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const wei = BigNumber.from(10).pow(18);

function App() {
  const {
    account,
    chainId,
    connected,
    connectWC,
    connectMetamask,
    // library,
    provider,
    sendTx,
    disconnect,
    error,
  } = useWallet();

  const [modalWalletOpen, setModalWalletOpen] = useState(false);
  const USDT =
    chainId === 1
      ? "0xdac17f958d2ee523a2206206994597c13d831ec7"
      : chainId === 4
      ? "0xD92E713d051C37EbB2561803a3b5FBAbc4962431"
      : "0xD92E713d051C37EbB2561803a3b5FBAbc4962431";
  // ; //USDT
  const ATHENA_ICO_CONTRACT_ADDRESS =
    chainId === 1
      ? "0xFDe2a58B64771e794DCCBC491cD3DE5623798729"
      : chainId === 4
      ? "0xFDe2a58B64771e794DCCBC491cD3DE5623798729"
      : "0xFDe2a58B64771e794DCCBC491cD3DE5623798729";
  const [loadingApprove, setLoadingApprove] = useState(false);
  const [notifHistory, setnotifHistory] = useState<
    { text: string; date: number; link?: string; amount?: string }[]
  >([]);

  const { value: ethPrice, error: ethPriceError } =
    useCall({
      contract: new Contract(ATHENA_ICO_CONTRACT_ADDRESS, abi),
      method: "getLatestPrice",
      args: [],
    }) ?? {};
  const { value: atenToken, error: atenTokenError } =
    useCall({
      contract: new Contract(ATHENA_ICO_CONTRACT_ADDRESS, abi),
      method: "aten",
      args: [],
    }) ?? {};
  const [isEth, setIsEth] = useState(true);
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [amount, setAmount] = useState("0");
  const [toggleETH, setToggleETH] = useState(false);
  const tokenBalance = useTokenBalance(USDT, account);
  const ATENbalance = useTokenBalance(atenToken?.[0], account);

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

  useEffect(() => {
    if (chainId && provider?.network) {
      init();
    }
  }, [chainId, provider]);

  const init = async () => {
    try {
      const contract = new ethers.Contract(
        ATHENA_ICO_CONTRACT_ADDRESS,
        abi,
        provider
      );
      setIsSaleOpen(await contract.activeSale());
      getHistoryEvents();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (account) {
      if (chainId && chainId !== 1 && chainId !== 4) {
        toast.error(
          "Wrong Chain ID : " + chainId + ", please switch to Ethereum Mainnet"
        );
        console.error("Wrong Chain ID ! ", chainId);
      }
    }
  }, [account, chainId]);

  const handleApprove = async (e: any) => {
    e.preventDefault();
    try {
      setLoadingApprove(true);
      const txData = usdtContract.interface.encodeFunctionData("approve", [
        ATHENA_ICO_CONTRACT_ADDRESS,
        ethers.utils.parseUnits(amount, 6),
      ]);
      const receipt = await sendTx(txData);
    } catch (error) {
      setLoadingApprove(false);
    }
  };

  useEffect(() => {
    if (account && modalWalletOpen) setModalWalletOpen(false);
    if (account && provider && chainId) {
      getHistoryEvents();
    }
  }, [account]);

  const getHistoryEvents = async () => {
    try {
      const contract = new ethers.Contract(
        ATHENA_ICO_CONTRACT_ADDRESS,
        abi,
        provider
      );
      const eventsHistory = await contract.queryFilter(
        contract.filters.Prebuy(account)
      );
      // const array = [];
      const array = await Promise.all(
        eventsHistory.map(async (ev) => ({
          text: "Transaction pre-sale",
          date: (await ev.getBlock()).timestamp * 1000,
          amount: ev.args?.amount?.toString(),
          link: getExplorerTransactionLink(ev.transactionHash, chainId),
        }))
      );
      setnotifHistory(array);
    } catch (error) {
      toast.warn("Could not get network");
      setnotifHistory([]);
    }
  };

  const handleMint = async (e: any) => {
    try {
      e.preventDefault();
      const txData = new ethers.Contract(
        ATHENA_ICO_CONTRACT_ADDRESS,
        abi
      ).interface.encodeFunctionData("prebuy", [
        ethers.utils.parseUnits(amount, isEth ? 18 : 6),
        isEth ? ETH : USDT,
        account,
      ]);
      const receipt = await sendTx({
        from: account,
        to: ATHENA_ICO_CONTRACT_ADDRESS,
        data: txData,
        chainId: chainId,
        value: isEth ? ethers.utils.parseEther(amount) : undefined,
      });
      toast.info("Transaction success", { autoClose: false });
      init();

      // const receipt = await send.wait();
      // console.log("RECEIPT", receipt);
      // addNotification(receipt);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <article>
        <header className="animated fadeIn wow">
          <h1 className="highlight double push-bottom">
            <span className="highlight-word underline-only no-underline">
              Public sale
            </span>{" "}
            <span className="highlight-word underline-only">round 1</span>
          </h1>
        </header>
        <div
          className="bg-primary card-sales"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {account ? (
            <ConnectButton
              className="btn btn-secondary"
              account={account}
              disconnect={disconnect}
              chainId={chainId}
            />
          ) : (
            <Button
              className="btn btn-secondary"
              style={{ marginBottom: 16 }}
              onClick={() => setModalWalletOpen(true)}
            >
              Connect to a Wallet
            </Button>
          )}
        </div>
        <form className="bg-primary card card-sales">
          <div className="corner">
            <div
              className={"sel" + (toggleETH ? " active" : "")}
              onClick={() => setToggleETH(!toggleETH)}
            >
              <span
                className="sel__placeholder"
                data-placeholder={isEth ? "ETH" : "USDT"}
              >
                {isEth ? "ETH" : "USDT"}
              </span>
              <div className="sel__box">
                <span
                  className="sel__box__options"
                  data-value="usdt"
                  onClick={(e) => setIsEth(false)}
                >
                  USDT
                </span>
                <span
                  className="sel__box__options selected"
                  data-value="eth"
                  onClick={(e) => setIsEth(true)}
                >
                  ETH
                </span>
              </div>
              {/* <select
                className="form-control"
                data-first-option="show"
                style={{ display: "none" }}
              >
                <option value="usdt">USDT</option>
                <option value="eth">ETH</option>
              </select> */}
            </div>
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
                    Number(amount) && ethPrice && isEth
                      ? parseFloat(
                          formatUnits(
                            BigNumber.from(
                              parseInt((Number(amount) * SCALER).toString())
                            )
                              .mul(wei)
                              .div(SCALER)
                              .mul(wei)
                              .div(ethPrice[0])
                              .mul(1000)
                              .div(35),
                            18
                          )
                        ).toFixed(4)
                      : Number(amount) && ethPrice && !isEth
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
                  Balance:{" "}
                  <span>
                    {parseFloat(formatEther(ATENbalance || "0")).toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div
            className={Number(amount) == 0 ? "collapse" : "show"}
            id="aten-info"
          >
            <div
              className="label label-ghost"
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <span>1 ATEN = $0.035</span>
              {isEth && (
                <span>
                  1 ETH = $
                  {ethPrice &&
                    formatUnits(BigNumber.from(10).pow(18).div(ethPrice[0]), 0)}
                </span>
              )}
            </div>
          </div>
          {!isSaleOpen ? (
            <Button className="btn btn-block btn-secondary" disabled={true}>
              Sale is Not Opened yet
            </Button>
          ) : !isEth &&
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
                !Number(amount) ||
                !(isEth
                  ? etherBalance?.gte(parseUnits(amount.toString()) || false)
                  : tokenBalance?.gte(parseUnits(amount.toString(), 6)) ||
                    false)
              }
            >
              Purchase ATEN
            </Button>
          )}
        </form>
        {notifHistory.length > 0 && (
          <>
            <h3>History</h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column-reverse",
                position: "absolute",
              }}
            >
              {notifHistory.map((notification, i) => (
                <div key={i} style={{ marginTop: 16 }}>
                  <p style={{ margin: 4 }}>
                    On :{" "}
                    {new Date(notification.date).toLocaleDateString() +
                      " - " +
                      new Date(notification.date).toLocaleTimeString()}
                  </p>
                  {notification.amount && (
                    <p style={{ margin: 4 }}>
                      Amount :{" "}
                      {Number(
                        ethers.utils.formatEther(notification.amount)
                      ).toFixed(2)}{" "}
                      ATEN
                    </p>
                  )}
                  <p style={{ margin: 4 }}>
                    {notification.link ? (
                      <a href={notification.link} target="_blank">
                        {"Tx explorer link"}
                      </a>
                    ) : (
                      notification.text
                    )}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </article>
      <Modal
        show={modalWalletOpen}
        onHide={() => setModalWalletOpen(false)}
        animation={false}
        centered
        contentClassName="card card-sales bg-primary"
      >
        <button
          type="button"
          className="close self-end"
          aria-label="Close"
          data-dismiss="modal"
          style={{ position: "absolute", right: 32 }}
          onClick={() => setModalWalletOpen(false)}
        >
          <img height={20} src="img/CLOSE.svg" />
        </button>
        <div className="row-flex fullWidth push-reset center-xs">
          <div className="col-xs-10 col-md-6">
            <img alt="Brand" width="100%" src="img/ATHENA-LOGO.svg" />
          </div>
          <ConnectButton
            className="btn btn-secondary"
            style={{
              marginTop: "32px",
              padding: "2px 8px",
              justifyContent: "space-around",
              display: "flex",
              flexDirection: "row",
            }}
            account={account}
            connectWC={connectWC}
            connectMetamask={connectMetamask}
            disconnect={disconnect}
          />
        </div>
      </Modal>
    </>
  );
}

export default App;
