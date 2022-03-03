// ConnectButton.tsx
import { useEthers, useEtherBalance } from "@usedapp/core";
import { formatEther } from "@ethersproject/units";
import { Button } from "./Components";
import CSS from "csstype";

export default function ConnectButton({
  className,
  style,
}: {
  className?: string;
  style?: CSS.Properties;
}) {
  const { activateBrowserWallet, account, deactivate, error } = useEthers();
  const etherBalance = useEtherBalance(account);

  function handleConnectWallet() {
    activateBrowserWallet();
  }

  error && console.error(error);
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
        onClick={() => deactivate()}
        // bg="gray.800"
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
    <Button className={className} onClick={handleConnectWallet}>
      Connect to a wallet
    </Button>
  );
}
