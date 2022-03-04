// ConnectButton.tsx
import { useEthers, useEtherBalance } from "@usedapp/core";
import { formatEther } from "@ethersproject/units";
import { Button } from "./Components";
import CSS from "csstype";

export default function ConnectButton({
  className,
  style,
  account,
  connectWC,
  connectMetamask,
  disconnect,
}: {
  className?: string;
  style?: CSS.Properties;
  account?: string;
  connectWC?: () => void;
  connectMetamask?: () => void;
  disconnect?: () => void;
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
              padding: 2,
              ...style,
            }
          : { display: "flex", alignItems: "center", ...style }
      }
    >
      <div style={{ margin: 4 }}>
        <span color="white">
          {etherBalance && parseFloat(formatEther(etherBalance)).toFixed(3)} ETH
        </span>
      </div>
      <Button
        className={className}
        style={{
          background: "gray",
          border: "1px solid transparent",
          borderRadius: 8,
          margin: 1,
          height: "38px",
          display: "flex",
          alignItems: "center",
        }}
        onClick={disconnect}
      >
        <span style={{ margin: 2, color: "white" }}>
          {account &&
            `${account.slice(0, 6)}...${account.slice(
              account.length - 4,
              account.length
            )}`}
        </span>
      </Button>
    </div>
  ) : (
    <div style={style}>
      <Button className={className} onClick={connectMetamask}>
        Metamask
      </Button>
      <Button
        className={className}
        onClick={() => connectWC?.()}
        style={{ marginLeft: 16 }}
      >
        Wallet Connect
      </Button>
    </div>
  );
}
