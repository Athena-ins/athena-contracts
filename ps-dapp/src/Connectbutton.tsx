// ConnectButton.tsx
import { getChainById, useEtherBalance } from "@usedapp/core";
import { Button, formatBalance } from "./Components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faLinkSlash } from "@fortawesome/free-solid-svg-icons";
import CSS from "csstype";
import { JsonRpcProvider } from "@ethersproject/providers";

export default function ConnectButton({
  className,
  style,
  account,
  connectWC,
  connectMetamask,
  disconnect,
  chainId,
  provider,
}: {
  className?: string;
  style?: CSS.Properties;
  account?: string;
  chainId?: number;
  connectWC?: () => void;
  connectMetamask?: () => void;
  disconnect?: () => void;
  provider?: JsonRpcProvider;
}) {
  const etherBalance = useEtherBalance(account);

  return account ? (
    <div
      className={className}
      style={
        !className
          ? {
              display: "flex",
              alignItems: "center",
              background: "#333333",
              borderRadius: 8,
              padding: "8px",
              margin: "1px",
              ...style,
            }
          : {
              display: "flex",
              alignItems: "center",
              padding: "8px",
              margin: "1px",
              ...style,
            }
      }
    >
      <div style={{ margin: 4 }}>
        <span color="white">{formatBalance(etherBalance)} ETH</span>
      </div>
      <Button
        // className={className}
        style={{
          background: "gray",
          borderRadius: 8,
          border: 0,
          // height: "32px",
          display: "flex",
          alignItems: "center",
        }}
        onClick={disconnect}
      >
        <span style={{ margin: 2, color: "white", padding: 1 }}>
          {account &&
            `${account.slice(0, 6)}...${account.slice(
              account.length - 4,
              account.length
            )}`}
        </span>
      </Button>
      {typeof chainId === "number" && (
        <span
          style={{
            paddingLeft: 8,
            color: [1, 4].includes(chainId) ? "inherit" : "red",
          }}
        >
          {[1, 4].includes(chainId) ? (
            <span>
              <FontAwesomeIcon icon={faLink}></FontAwesomeIcon>
              {getChainById(chainId)?.chainName}
            </span>
          ) : (
            <span>
              <FontAwesomeIcon icon={faLinkSlash}></FontAwesomeIcon>
              Wrong network
            </span>
          )}
        </span>
      )}
    </div>
  ) : (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        ...style,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Button
        className={className}
        onClick={connectMetamask}
        style={{
          height: 110,
          width: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#f8901c",
          margin: 4,
        }}
      >
        <img src="img/metamask.png" width="100px" alt="logo" />
        Metamask
      </Button>
      <Button
        className={className}
        onClick={connectMetamask}
        style={{
          height: 110,
          width: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          margin: 4,
        }}
      >
        <img src="img/trustwallet.png" height="90px" alt="logo" />
      </Button>
      <Button
        className={className}
        onClick={() => connectWC?.()}
        style={{
          height: 110,
          width: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          margin: 4,
          color: "#3b99fc",
        }}
      >
        <img height="60px" src="img/walletconnect.png" />
        Wallet Connect
      </Button>
    </div>
  );
}
