// ConnectButton.tsx
import { useEthers, useEtherBalance } from "@usedapp/core";
import { formatEther } from "@ethersproject/units";
import { Button } from "./Components";

export default function ConnectButton() {
  const { activateBrowserWallet, account, deactivate } = useEthers();
  const etherBalance = useEtherBalance(account);

  function handleConnectWallet() {
    activateBrowserWallet();
  }

  return account ? (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "#333333",
        borderRadius: 8,
        padding: 2,
      }}
    >
      <div style={{ margin: 4 }}>
        <span color="white">
          {etherBalance && parseFloat(formatEther(etherBalance)).toFixed(3)} ETH
        </span>
      </div>
      <Button
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
    <Button onClick={handleConnectWallet}>Connect to a wallet</Button>
  );
}
