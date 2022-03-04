import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import type { TransactionResponse } from "@ethersproject/providers";
import { ReactElement } from "react";
import {
  getExplorerTransactionLink,
  Notification,
  shortenTransactionHash,
} from "@usedapp/core";
import { BigNumber } from "ethers";
import { formatEther } from "ethers/lib/utils";

export const Colors = {
  Black: {
    900: "#23242A",
    200: "#DDE2EB",
  },
  Gray: {
    600: "#757575",
    300: "#E0E0E0",
  },
  White: "#ffffff",
  Yellow: {
    500: "#F2C94C",
    200: "#fff9e6",
    100: "#FFF4D4",
  },
  Red: { 400: "#F87171" },
};

export const Fonts = {
  Helvetica: '"HelveticaNeue", sans-serif',
};

export const Shadows = {
  main: "0px 4px 28px rgba(136, 169, 200, 0.15)",
  notification: "0px 4px 14px rgba(136, 169, 200, 0.3)",
};

export const Sizes = {
  headerHeight: "64px",
};

export const Gradients = {
  bodyBackground: `linear-gradient(180deg, ${Colors.Yellow[100]}, ${Colors.White})`,
};

export const Transitions = {
  duration: "0.25s",
  all: "all 0.25s ease",
};

export const BorderRad = {
  s: "8px",
  m: "24px",
  round: "50%",
  full: "1000px",
};

interface ListElementProps {
  icon: ReactElement;
  title: string | undefined;
  transaction?: TransactionResponse;
  date: number;
}

const formatter = new Intl.NumberFormat("en-us", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const formatBalance = (balance: BigNumber | undefined) =>
  formatter.format(parseFloat(formatEther(balance ?? BigNumber.from("0"))));

export const Button = styled.button`
  :disabled {
    background: grey;
  }
`;

export const NotificationElement = ({
  transaction,
  icon,
  title,
}: ListElementProps) => {
  return (
    <NotificationWrapper
      layout
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <NotificationIconContainer>{icon}</NotificationIconContainer>
      <NotificationDetailsWrapper>
        <NotificationText>{title}</NotificationText>
        <TransactionLink transaction={transaction} />
        <TransactionDetails>
          {transaction &&
            `${shortenTransactionHash(transaction?.hash)} #${
              transaction.nonce
            }`}
        </TransactionDetails>
      </NotificationDetailsWrapper>
      {transaction && (
        <div style={{ marginLeft: "auto" }}>
          - {formatBalance(transaction.value)} ETH
        </div>
      )}
    </NotificationWrapper>
  );
};

const TransactionLink = ({
  transaction,
}: {
  transaction: TransactionResponse | undefined;
}) => (
  <>
    {transaction && (
      <Link
        href={getExplorerTransactionLink(transaction.hash, transaction.chainId)}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on Etherscan
        <LinkIconWrapper>
          <ShareIcon />
        </LinkIconWrapper>
      </Link>
    )}
  </>
);

export const ShareIcon = () => (
  <svg viewBox="0 0 10 11" fill="none" color="currentColor">
    <path
      fill="currentColor"
      color="currentColor"
      d="M8.14394 6.45953H7.76512C7.70979 6.45953 7.66439 6.47844 7.62907 6.51643C7.59345 6.55419 7.57573 6.6026 7.57573 6.66155V8.68174C7.57573 8.95953 7.48307 9.19728 7.29764 9.39512C7.11221 9.59291 6.88923 9.69174 6.6288 9.69174H1.70451C1.4441 9.69174 1.22114 9.59291 1.03567 9.39512C0.850242 9.19731 0.757538 8.95956 0.757538 8.68174V3.42919C0.757538 3.15142 0.850222 2.91369 1.03567 2.71587C1.22114 2.51803 1.4441 2.41917 1.70451 2.41917H4.22535C4.28068 2.41917 4.32608 2.40018 4.36155 2.36234C4.39702 2.32446 4.41474 2.2761 4.41474 2.21713V1.81303C4.41474 1.75417 4.39702 1.70572 4.36155 1.66791C4.32608 1.63003 4.28068 1.61113 4.22535 1.61113H1.70451C1.23501 1.61113 0.833513 1.78895 0.50005 2.14458C0.166711 2.50019 0 2.92846 0 3.42926V8.68183C0 9.1826 0.166711 9.61094 0.500071 9.96643C0.833534 10.3221 1.23503 10.5 1.70453 10.5H6.6288C7.09828 10.5 7.49982 10.3221 7.83324 9.96643C8.16668 9.61094 8.33339 9.18262 8.33339 8.68183V6.6617C8.33339 6.60269 8.31565 6.55426 8.28003 6.51643C8.24452 6.47844 8.19912 6.45953 8.14394 6.45953Z"
    />
    <path
      fill="currentColor"
      color="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.40766 1.26336V0.5L10 0.5L10 5.19992H9.25411V1.26336H5.40766Z"
    />
    <path
      fill="currentColor"
      color="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.76725 0.749511C9.90926 0.894841 9.90926 1.13047 9.76725 1.2758L3.89336 7.28728C3.75136 7.43261 3.52112 7.43261 3.37912 7.28728C3.23712 7.14195 3.23712 6.90633 3.37912 6.761L9.25301 0.749511C9.39502 0.604182 9.62525 0.604182 9.76725 0.749511Z"
    />
  </svg>
);

export const Link = styled.a`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  text-decoration: underline;
  color: ${Colors.Gray["600"]};
  cursor: pointer;
  transition: ${Transitions.all};
  &:hover,
  &:focus-within {
    color: ${Colors.Yellow[500]};
  }
`;

const LinkIconWrapper = styled.div`
  width: 12px;
  height: 12px;
  margin-left: 8px;
`;

export const Text = styled.p`
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
`;

export const TextInline = styled.span`
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
`;

export const TextBold = styled(Text)`
  font-weight: 700;
`;

const NotificationText = styled(TextBold)`
  font-size: 20px;
  margin-bottom: 5px;
`;

const TransactionDetails = styled.div`
  font-size: 14px;
`;

const NotificationWrapper = styled(motion.div)`
  display: flex;
  align-items: center;
  background-color: #15247e; //${Colors.White};
  box-shadow: ${Shadows.notification};
  width: 395px;
  border-radius: 10px;
  margin: 15px;
  padding: 10px 20px 10px 20px;
`;

export const NotificationsWrapper = styled.div`
  position: fixed;
  right: 24px;
  bottom: 24px;
`;

const NotificationIconContainer = styled.div`
  width: 60px;
  height: 60px;
  padding: 0px;
  margin-right: 20px;
`;

const ListIconContainer = styled.div`
  width: 48px;
  height: 48px;
  padding: 12px;
  padding: 14px 16px 14px 12px;
`;

const ListElementWrapper = styled(motion.div)`
  display: flex;
  justify-content: space-between;
`;

const NotificationDetailsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 4px 0;
`;

const ListDetailsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 4px 0;
`;

export const notificationContent: {
  [key in Notification["type"]]: { title: string; icon: ReactElement };
} = {
  transactionFailed: { title: "Transaction failed", icon: <span>!!!</span> },
  transactionStarted: {
    title: "Transaction started",
    icon: <span>Clock</span>,
  },
  transactionSucceed: {
    title: "Transaction succeed",
    icon: <span>Check</span>,
  },
  walletConnected: { title: "Wallet connected", icon: <span>Wallet</span> },
};