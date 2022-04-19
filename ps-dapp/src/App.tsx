import { faInfoCircle, faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  getExplorerTransactionLink,
  useCall,
  useTokenAllowance,
  useTokenBalance,
} from "@usedapp/core";
import { BigNumber, ethers } from "ethers";
import { formatEther, formatUnits, parseUnits } from "ethers/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import { Button, ButtonAddMetamask, formatBalance, LiAten } from "./Components";
import ConnectButton from "./Connectbutton";
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
const USDC: { [chainId: number]: string } = {
  [1]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [4]: "0xeb8f08a975Ab53E34D8a0330E0D34de942C95926",
  [0]: "0xD92E713d051C37EbB2561803a3b5FBAbc4962431",
};
const ATHENA_ICO_CONTRACT_ADDRESS: { [chainId: number]: string } = {
  [1]: "0x8bFad5636BBf29F75208acE134dD23257C245391",
  [4]: "0x8F23520FdA6B183bbAA072b7d57375F7bE27db6d",
  [0]: "0x41f84D3448f6f9576e51114382Af277A6B95f939",
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

  const [isUSDT, setIsUSDT] = useState(true);
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [distributeMonth, setDistributeMonth] = useState(0);
  const [vestingDate, setVestingDate] = useState(0);
  const [tokensAvailable, setTokensAvailable] = useState(0);
  const [tokensSold, setTokensSold] = useState(_0);
  const [maxTokens, setMaxTokens] = useState(_0);
  const [atenToClaim, setAtenToClaim] = useState(_0);
  const [amount, setAmount] = useState("0");
  const [toggleETH, setToggleETH] = useState(false);
  const usdtBalance = useTokenBalance(USDT[chainId], account);
  const usdcBalance = useTokenBalance(USDC[chainId], account);
  const ATENbalance = useTokenBalance(ATEN_TOKEN_ADDRESS[chainId], account);

  const usdtAllowance = useTokenAllowance(
    USDT[chainId],
    account,
    ATHENA_ICO_CONTRACT_ADDRESS[chainId]
  );

  const usdcAllowance = useTokenAllowance(
    USDC[chainId],
    account,
    ATHENA_ICO_CONTRACT_ADDRESS[chainId]
  );

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
      setDistributeMonth(0);
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
      getHistoryEvents();
      setVestingDate(await contract.dateStartVesting());
    } catch (error: any) {
      // if (error.message.includes("activeSale()"))
      console.error(error.message);
    }
  };

  const handleApprove = async (e: any) => {
    e.preventDefault();
    try {
      const usdxContract = new ethers.Contract(
        isUSDT ? USDT[chainId] : USDC[chainId],
        erc20abi
      );
      const txData = usdxContract.interface.encodeFunctionData("approve", [
        ATHENA_ICO_CONTRACT_ADDRESS[chainId],
        ethers.utils.parseUnits(amount, 6),
      ]);
      const receipt = await sendTx({
        from: account,
        to: usdxContract.address,
        data: txData,
      });
      logReceipt(receipt);
    } catch (error) {
      console.error(error);
    }
  };

  const watchTx = (hash: string) => {
    const id = setInterval(() => {
      provider?.getTransactionReceipt(hash).then((receipt) => {
        if (receipt) {
          setAmount("0");
          toast.success("Transaction Successful");
          init();
          clearInterval(id);
        }
      });
    }, 3000);
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
          text: "Transaction Buy",
          date: (await ev.getBlock()).timestamp * 1000,
          amount: ev.args?.amount?.toString(),
          link: getExplorerTransactionLink(ev.transactionHash, chainId),
        }))
      );
      setnotifHistory(array);
      const presales = await contract.presales(account);
      setAtenToClaim(presales);
      contract
        .available(0)
        .then((res: number) => {
          setTokensAvailable(res);
        })
        .catch((err: any) => console.error(err));
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
      ).interface.encodeFunctionData("buy", [
        ethers.utils.parseUnits(amount, isUSDT ? 6 : 6).toString(),
        isUSDT ? USDT[chainId] : USDC[chainId],
      ]);
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

  const handleDistribute = async (_e: any) => {
    try {
      if (!account) return toast.warning("Can not Claim, missing account");
      const txData = new ethers.Contract(
        ATHENA_ICO_CONTRACT_ADDRESS[chainId],
        abi
      ).interface.encodeFunctionData("distribute", ["0"]);
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
      watchTx(receipt?.hash || receipt);
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
              Private sale
            </span>{" "}
            <span className="highlight-word underline-only">partners</span>
          </h1>
        </header>
        <div id="versionVC01" />
        {maxTokens.gt(0) &&
          isSaleOpen &&
          !distributeMonth &&
          tokensSold.gte(maxTokens.mul(60).div(100)) && (
            <div
              className="bg-primary card-sales"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "flex-start",
              }}
            >
              <span>
                Tokens sold :{" "}
                {(
                  tokensSold.mul(10000).div(maxTokens).toNumber() / 100
                ).toFixed(2) + "%"}
              </span>
              {/* {formatBalance(tokensSold) + " / " + formatBalance(maxTokens)} */}
              <motion.div
                initial={{ width: 0 }}
                style={{
                  height: 12,
                  borderRadius: "6px 0 0 6px",
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
        {!distributeMonth ? (
          <form className="bg-primary card card-sales">
            <div className="corner">
              <div
                className={"sel" + (toggleETH ? " active" : "")}
                onClick={() => setToggleETH(!toggleETH)}
              >
                <span
                  className="sel__placeholder"
                  data-placeholder={isUSDT ? "USDT" : "USDC"}
                >
                  {isUSDT ? "USDT" : "USDC"}
                </span>
                <div className="sel__box">
                  <span
                    className="sel__box__options"
                    data-value="usdt"
                    onClick={(e) => setIsUSDT(true)}
                  >
                    USDT
                  </span>
                  <span
                    className="sel__box__options selected"
                    data-value="usdc"
                    onClick={(e) => setIsUSDT(false)}
                  >
                    USDC
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
                          (isUSDT ? usdtBalance : usdcBalance) || "0",
                          isUSDT ? 6 : 6
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
                    value={formatBalance(
                      BigNumber.from(
                        parseInt((Number(amount) * SCALER).toString())
                      )
                        .mul(10 ** 6)
                        .div(SCALER)
                        .mul(10000)
                        .div(50),
                      6
                    )}
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
                <span>1 ATEN = $0.005</span>
              </div>
            </div>
            {!isSaleOpen ? (
              <Button className="btn btn-block btn-secondary" disabled={true}>
                Sale is Not Available
              </Button>
            ) : Number(amount) &&
              (isUSDT
                ? usdtAllowance?.lt(
                    BigNumber.from(
                      parseInt((Number(amount) * SCALER).toString())
                    )
                      .mul(10 ** 6)
                      .div(SCALER)
                  )
                : usdcAllowance?.lt(
                    BigNumber.from(
                      parseInt((Number(amount) * SCALER).toString())
                    )
                      .mul(10 ** 6)
                      .div(SCALER)
                  )) ? (
              <Button
                className="btn btn-block btn-info"
                type="submit"
                onClick={handleApprove}
                disabled={!account}
              >
                APPROVE {isUSDT ? "USDT" : "USDC"}
              </Button>
            ) : (
              <Button
                className="btn btn-block btn-secondary"
                type="submit"
                onClick={handleMint}
                disabled={
                  !account ||
                  !Number(amount) ||
                  !(isUSDT
                    ? usdtBalance?.gte(
                        parseUnits(amount.toString(), 6) || false
                      )
                    : usdcBalance?.gte(parseUnits(amount.toString(), 6)) ||
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
              <Button
                className="btn btn-block btn-secondary"
                type="submit"
                onClick={handleDistribute}
                disabled={
                  !account || distributeMonth === 0 || vestingDate === 0
                }
              >
                Distribute ATENs
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
              <LiAten>Maximum of 1 300 000 USDT purchase</LiAten>
              <LiAten>
                Tokens will be released as stated for partners in white paper,
                from claim activation to + 3 months, then 5% month 4 to 7, and
                10% month 8 to 12.
              </LiAten>
              <LiAten>
                Tokens will be distributed by the team. Would anyone want to be
                faster, the distribute function is public !
              </LiAten>
              <LiAten>
                Legal disclaimer for the sale is available{" "}
                <a href="disclaimer.html" target="_blank">
                  here
                </a>
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
