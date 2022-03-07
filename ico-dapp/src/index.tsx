import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { Mainnet, DAppProvider, Config } from "@usedapp/core";

const config: Config = {
  readOnlyChainId: Mainnet.chainId,
  readOnlyUrls: {
    [Mainnet.chainId]:
      "https://eth-mainnet.alchemyapi.io/v2/STnnAuDaTiWez3QJ-KCTNieo_I6Px4fw", //restricted to athena-co.io
  },
};

ReactDOM.render(
  <DAppProvider config={{}}>
    <App />
  </DAppProvider>,
  document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
