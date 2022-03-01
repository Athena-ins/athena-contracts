import "./App.css";
import { useEtherBalance, useEthers, useTokenBalance } from "@usedapp/core";
import ConnectButton from "./Connectbutton";
import { Button } from "./Components";
import { createRef, useEffect, useState } from "react";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";

const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"; //USDT
const wei = BigNumber.from(10).pow(18);

function App() {
  const { account } = useEthers();
  const [isEth, setIsEth] = useState(true);
  const [amount, setAmount] = useState(0);
  const tokenBalance = useTokenBalance(USDT, account);
  const etherBalance = useEtherBalance(account);

  const handleMint = (e: any) => {
    e.preventDefault();
    console.log("MINT : ", e);
    console.log("Switch : ", isEth);
    console.log("Amount : ", amount);
  };

  return (
    <div className="App">
      <header className="App-header">
        <ConnectButton />
        <h1>ATHENA ICO Pre-sale</h1>
        <form onSubmit={handleMint}>
          <div
            style={{
              margin: 8,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span>ETH</span>
            <label style={{ margin: 8 }} className="switch">
              <input type="checkbox" onChange={() => setIsEth(!isEth)} />
              <span className="slider round"></span>
            </label>
            <span>USDT</span>
          </div>
          <div>
            <label htmlFor="name">Amount : </label>
            <input
              style={{ borderRadius: 8, textAlign: "right", padding: 4 }}
              type="number"
              name="amount"
              id="amount"
              required
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            {isEth ? " ETH" : " USDT"}
          </div>
          <div>
            <p>
              Available :{" "}
              {formatUnits((isEth ? etherBalance : tokenBalance) || "0", 18)}
            </p>
          </div>
          <Button
            type="submit"
            onClick={handleMint}
            disabled={
              !amount ||
              !(isEth
                ? etherBalance?.gt(parseUnits(amount.toString()) || false)
                : tokenBalance?.gt(parseUnits(amount.toString())) || false)
            }
          >
            Mint me
          </Button>
        </form>
      </header>
    </div>
  );
}

export default App;
