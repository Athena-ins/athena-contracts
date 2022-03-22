import {
  getExplorerTransactionLink,
  useCall,
  useEtherBalance,
  useTokenAllowance,
  useTokenBalance,
} from "@usedapp/core";
import ConnectButton from "./Connectbutton";
import { toast } from "react-toastify";
import { Button, ButtonAddMetamask, formatBalance, LiAten } from "./Components";
import { Modal } from "react-bootstrap";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWarning, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";

import {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "ethers/lib/utils";
import { BigNumber, ethers } from "ethers";
import abi from "./contractAbi.json";
import erc20abi from "./erc20abi.json";
import { useWallet } from "./useWallet";
const SCALER = 10000000;
const _0 = BigNumber.from("0");
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const wei = BigNumber.from(10).pow(18);

const USDT: { [chainId: number]: string } = {
  [1]: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  [4]: "0xD92E713d051C37EbB2561803a3b5FBAbc4962431",
  [0]: "0xD92E713d051C37EbB2561803a3b5FBAbc4962431",
};
// ; //USDT

const ATHENA_ICO_CONTRACT_ADDRESS: { [chainId: number]: string } = {
  [1]: "0x8bFad5636BBf29F75208acE134dD23257C245391",
  [4]: "0xd6D479596061326F6caF486921441ED44Ea0076b",
  [0]: "0xd6D479596061326F6caF486921441ED44Ea0076b",
};

const ATEN_TOKEN_ADDRESS: { [chainId: number]: string } = {
  [1]: "0x86ceb9fa7f5ac373d275d328b7aca1c05cfb0283",
  [4]: "0x2da9F0DF7DC5f9F6e024B4ABf97148B405D9b4F8",
  [0]: "0x2da9F0DF7DC5f9F6e024B4ABf97148B405D9b4F8",
};

function App() {
  const {
    account,
    chainId,
    connectWC,
    connectMetamask,
    provider,
    sendTx,
    disconnect,
    error,
  } = useWallet();

  const [modalWalletOpen, setModalWalletOpen] = useState(false);

  const [notifHistory, setnotifHistory] = useState<
    { text: string; date: number; link?: string; amount?: string }[]
  >([]);

  const { value: ethPrice, error: errorEthPrice } =
    useCall({
      contract: new ethers.Contract(
        ATHENA_ICO_CONTRACT_ADDRESS[chainId] || ATHENA_ICO_CONTRACT_ADDRESS[0],
        abi
      ),
      method: "getLatestPrice",
      args: [],
    }) ?? {};
  const [isEth, setIsEth] = useState(true);
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [tokensSold, setTokensSold] = useState(_0);
  const [maxTokens, setMaxTokens] = useState(_0);
  const [atenToClaim, setAtenToClaim] = useState(_0);
  const [allowedClaim, setAllowedClaimed] = useState(_0);
  const [availableToClaim, setAvailableToClaim] = useState(_0);
  const [amount, setAmount] = useState("0");
  const [toggleETH, setToggleETH] = useState(false);
  const tokenBalance = useTokenBalance(USDT[chainId], account);
  const ATENbalance = useTokenBalance(ATEN_TOKEN_ADDRESS[chainId], account);

  const tokenAllowance = useTokenAllowance(
    USDT[chainId],
    account,
    ATHENA_ICO_CONTRACT_ADDRESS[chainId]
  );
  const etherBalance = useEtherBalance(account);

  useEffect(() => {
    if (account && modalWalletOpen) setModalWalletOpen(false);
    if (chainId === provider?.network?.chainId && account) {
      init();
    }
    if (account && chainId && chainId !== 1 && chainId !== 4) {
      toast.error(
        "Wrong Chain ID : " + chainId + ", please switch to Ethereum Mainnet"
      );
      console.error("Wrong Chain ID ! ", chainId);
      setIsSaleOpen(false);
      setIsClaimOpen(false);
      setnotifHistory([]);
    }
  }, [chainId, provider?.network?.chainId, account]);

  const init = async () => {
    try {
      const contract = new ethers.Contract(
        ATHENA_ICO_CONTRACT_ADDRESS[chainId] || ATHENA_ICO_CONTRACT_ADDRESS[0],
        abi,
        provider
      );
      const code = await provider?.getCode(
        ATHENA_ICO_CONTRACT_ADDRESS[chainId] || ATHENA_ICO_CONTRACT_ADDRESS[0]
      );
      if (!code || code === "0x00")
        return toast.warn("Contract is not deployed on this network");

      const isitactive = await contract.activeSale();

      setIsSaleOpen(isitactive);
      setMaxTokens(await contract.maxTokensSale());
      setTokensSold(await contract.tokenSold());
      setIsClaimOpen(await contract.activeClaim());
      getHistoryEvents();
    } catch (error: any) {
      // if (error.message.includes("activeSale()"))

      console.error(error.message);
    }
  };

  const handleApprove = async (e: any) => {
    e.preventDefault();
    try {
      const usdtContract = new ethers.Contract(USDT[chainId], erc20abi);
      const txData = usdtContract.interface.encodeFunctionData("approve", [
        ATHENA_ICO_CONTRACT_ADDRESS[chainId],
        ethers.utils.parseUnits(amount, 6),
      ]);
      const receipt = await sendTx({
        from: account,
        to: usdtContract.address,
        data: txData,
      });
      logReceipt(receipt);
    } catch (error) {
      console.error(error);
    }
  };

  const getHistoryEvents = async () => {
    try {
      if (!account) return;
      const contract = new ethers.Contract(
        ATHENA_ICO_CONTRACT_ADDRESS[chainId],
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
      const presales = await contract.presales(account);
      setAtenToClaim(presales);

      const available = await contract.availableClaim(account);
      setAllowedClaimed(await contract.allowedClaim());
      setAvailableToClaim(available);
    } catch (error: any) {
      console.error(error);
      setnotifHistory([]);
      if (error.message.includes('method="presales(address)"')) return;
      toast.warn("Could not get network");
    }
  };

  const handleMint = async (e: any) => {
    try {
      e.preventDefault();
      if (!account) return toast.warning("Can not send Tx, missing account");
      const txData = new ethers.Contract(
        ATHENA_ICO_CONTRACT_ADDRESS[chainId],
        abi
      ).interface.encodeFunctionData("prebuy", [
        ethers.utils.parseUnits(amount, isEth ? 18 : 6),
        isEth ? ETH : USDT[chainId],
        account,
      ]);
      const receipt = await sendTx({
        from: account,
        to: ATHENA_ICO_CONTRACT_ADDRESS[chainId],
        data: txData,
        chainId: chainId,
        value: isEth ? ethers.utils.parseEther(amount) : undefined,
      });
      logReceipt(receipt);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleClaim = async (_e: any) => {
    try {
      if (!account) return toast.warning("Can not Claim, missing account");
      const txData = new ethers.Contract(
        ATHENA_ICO_CONTRACT_ADDRESS[chainId],
        abi
      ).interface.encodeFunctionData("claim");
      const receipt = await sendTx({
        from: account,
        to: ATHENA_ICO_CONTRACT_ADDRESS[chainId],
        data: txData,
        chainId: chainId,
      });
      logReceipt(receipt);
    } catch (error: any) {
      console.error(error);
    }
  };

  const logReceipt = (receipt?: any, text?: string) => {
    if (receipt) {
      toast.info(
        <p>
          <span>Transaction ongoing</span>
          <br />
          <a
            target="_blank"
            href={getExplorerTransactionLink(
              typeof receipt === "string" ? receipt : receipt.hash,
              chainId
            )}
          >
            Link to Explorer
          </a>
        </p>,
        { autoClose: 20000, closeOnClick: false }
      );
      setnotifHistory((prev) => [
        ...prev,
        {
          text: "Transaction awaiting confirmation",
          date: Date.now(),
          link: getExplorerTransactionLink(
            typeof receipt === "string" ? receipt : receipt.hash,
            chainId
          ),
        },
      ]);
      setTimeout(init, 60000);
    }
  };

  const addToMetamask = async (e: any) => {
    try {
      e.preventDefault();
      if (!provider?.network) return;
      // wasAdded is a boolean. Like any RPC method, an error may be thrown.
      const wasAdded = await provider.send("wallet_watchAsset", {
        type: "ERC20", // Initially only supports ERC20, but eventually more!
        options: {
          address: ATEN_TOKEN_ADDRESS[chainId], // The address that the token is at.
          symbol: "ATEN", // A ticker symbol or shorthand, up to 5 chars.
          decimals: 18, // The number of decimals in the token
          image: "https://static.athena-co.io/img/ATEN.png", // A string url of the token logo
        },
      } as any);

      if (wasAdded) {
        console.log("Thanks for your interest!");
      } else {
        console.log("Your loss!");
      }
    } catch (error: any) {
      console.log(error);
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
          {maxTokens.gt(0) &&
            isSaleOpen &&
            tokensSold > parseEther("30000000") && (
              <div>
                Tokens sold :{" "}
                {(
                  tokensSold.mul(10000).div(maxTokens).toNumber() / 100
                ).toFixed(2) + "%"}
                {/* {formatBalance(tokensSold) + " / " + formatBalance(maxTokens)} */}
                <motion.div
                  initial={{ width: 0 }}
                  style={{
                    height: 8,
                    borderRadius: "4px 0 0 4px",
                    backgroundColor: "#f2fc20",
                  }}
                  animate={{
                    width: `
                      ${Math.max(
                        parseInt(
                          tokensSold
                            .mul(10000)
                            .div(maxTokens)
                            .div(10000)
                            .toNumber()
                            .toString()
                        ),
                        10
                      )}%`,
                  }}
                  transition={{
                    type: "spring",
                    duration: 2,
                    repeat: 1,
                    bounce: 0.6,
                  }}
                />
              </div>
            )}
        </header>
        <div id="version03" />
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
              provider={provider}
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
        {!isClaimOpen ? (
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
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <div className="badge badge-secondary">
                  <span className="aten">ATEN</span>
                </div>
                <ButtonAddMetamask addToMetamask={addToMetamask} />
              </div>
              <div className="row-flex bottom-md mini-push-top">
                <div
                  className="col-xs-12 col-md-8"
                  style={{ display: "flex", flexDirection: "row" }}
                >
                  <input
                    name="result"
                    readOnly
                    className="form-control"
                    value={
                      Number(amount) && ethPrice?.[0] && isEth
                        ? formatBalance(
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
                        : Number(amount) && !isEth
                        ? formatBalance(
                            BigNumber.from(
                              parseInt((Number(amount) * SCALER).toString())
                            )
                              .mul(10 ** 6)
                              .div(SCALER)
                              .mul(1000)
                              .div(35),
                            6
                          )
                        : "0"
                    }
                  />

                  <div
                    style={{ paddingLeft: 8 }}
                    title="Warning: Aten amount is an estimate but not guaranteed, and
                final amount will be registered by the ICO smart contract at
                transaction time only."
                  >
                    <FontAwesomeIcon icon={faWarning} />
                  </div>
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
                    {ethPrice?.[0] &&
                      formatUnits(
                        BigNumber.from(10).pow(18).div(ethPrice[0]),
                        0
                      )}
                  </span>
                )}
              </div>
            </div>
            {!isSaleOpen ? (
              <Button className="btn btn-block btn-secondary" disabled={true}>
                Sale is Not Available
              </Button>
            ) : !isEth &&
              Number(amount) &&
              tokenAllowance?.lt(
                BigNumber.from(parseInt((Number(amount) * SCALER).toString()))
                  .mul(10 ** 6)
                  .div(SCALER)
              ) ? (
              <Button
                className="btn btn-block btn-info"
                type="submit"
                onClick={handleApprove}
                disabled={!account}
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
        ) : (
          <div className="bg-primary card card-sales">
            <div className="corner">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div
                  className="badge badge-secondary"
                  style={{ marginRight: 16 }}
                >
                  <span className="aten">ATEN</span>
                </div>
                <ButtonAddMetamask addToMetamask={addToMetamask} />
              </div>
              <p className="bal" style={{ margin: 8 }}>
                Balance:{" "}
                <span>
                  {parseFloat(formatEther(ATENbalance || "0")).toFixed(2)}
                </span>
              </p>
              <p className="bal" style={{ margin: 8 }}>
                Locked :{" "}
                {formatBalance(
                  atenToClaim.sub(
                    BigNumber.from(allowedClaim).mul(atenToClaim).div(4)
                  )
                )}
              </p>
              <Button
                className="btn btn-block btn-secondary"
                type="submit"
                onClick={handleClaim}
                disabled={!account || availableToClaim.toString() === "0"}
              >
                Claim {formatBalance(availableToClaim)} ATEN
              </Button>
            </div>
          </div>
        )}{" "}
        <section
          className="animated fadeIn wow"
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            justifyContent: "center",
            alignItems: "center",
            maxHeight: 600,
          }}
        >
          <div>
            <motion.h2
              animate={{
                scale: [1, 1.04, 1],
              }}
              transition={{
                type: "spring",
                duration: 2,
                repeat: 3,
                bounce: 0.6,
              }}
            >
              <FontAwesomeIcon icon={faInfoCircle} /> Sale information
            </motion.h2>
            <ul>
              <LiAten>Minimum of 200 USDT (or ETH equivalent) purchase</LiAten>
              <LiAten>
                Maximum of 15 000 USDT (or ETH equivalent) purchase
              </LiAten>
              <LiAten>
                Tokens will be released in 4 steps, from claim activation to +30
                days each (so D+90 days)
              </LiAten>
              <LiAten>You will have to claim your tokens at end of sale</LiAten>
              <LiAten>
                Claims can be cumulated if more than 1 step is passed to save on
                gas
              </LiAten>
            </ul>
            {notifHistory.length > 0 && (
              <div>
                <h3>History</h3>
                <div>Total Aten : {formatBalance(atenToClaim)}</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column-reverse",
                    maxHeight: 400,
                    overflowY: "scroll",
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
              </div>
            )}
          </div>
        </section>
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
