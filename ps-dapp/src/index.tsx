import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { Mainnet, DAppProvider, Config, Rinkeby } from "@usedapp/core";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const config: Config = {
  readOnlyChainId:
    process.env.NODE_ENV === "production" ? Mainnet.chainId : Rinkeby.chainId,
  readOnlyUrls: {
    [Mainnet.chainId]:
      process.env.NODE_ENV === "production"
        ? "https://eth-mainnet.alchemyapi.io/v2/STnnAuDaTiWez3QJ-KCTNieo_I6Px4fw" //restricted to athena-co.io
        : "https://eth-mainnet.alchemyapi.io/v2/Mly4IF7lnfXrOCqP2syy5YBcqtwUQYxU",
    [Rinkeby.chainId]:
      "https://eth-rinkeby.alchemyapi.io/v2/cC4j_jLDMaEvYZZAC5pXetu4ZyZ2MDnX", //RINKEBY NOT RESTRICTED
  },
  networks: [Mainnet, Rinkeby],
};

ReactDOM.render(
  <DAppProvider config={config}>
    <App />
    <ToastContainer position="top-right" theme="colored" />
  </DAppProvider>,
  document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
