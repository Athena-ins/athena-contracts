import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { BounceLoader } from "react-spinners";
import styled from "styled-components";
import { css } from "@emotion/css";

export interface ButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  loading?: boolean;
}
const formatter = new Intl.NumberFormat("en-us", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const formatBalance = (balance: BigNumber | undefined, units = 18) =>
  formatter.format(
    parseFloat(formatUnits(balance ?? BigNumber.from("0"), units))
  );

const buttonCss = css`
  margin-right: 8px;
  margin-bottom: -4px;
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
  -webkit-animation: spin 1s ease-in-out infinite;

  @keyframes spin {
    to {
      -webkit-transform: rotate(360deg);
    }
  }
  @-webkit-keyframes spin {
    to {
      -webkit-transform: rotate(360deg);
    }
  }
`;

const LoadingButton = (props: ButtonProps) => {
  const { loading, children, ...rest } = props;
  return (
    <button {...rest}>
      {loading && <div className={buttonCss} />}
      {children}
    </button>
  );
};

export const Button = styled(LoadingButton)`
  :disabled {
    background: grey;
  }
  :loading {
    background: blue;
  }
`;

export const ButtonAddMetamask = ({
  addToMetamask,
}: {
  addToMetamask: (e: any) => void;
}) => {
  return (
    <button
      onClick={addToMetamask}
      style={{
        border: 0,
        borderRadius: 16,
        color: "#f8901c",
        fontSize: 20,
      }}
    >
      +{" "}
      <img
        src="img/metamask.png"
        height="30px"
        style={{
          objectFit: "cover",
          paddingRight: 1,
          paddingBottom: 1,
        }}
        width="30px"
        alt="logo"
      />
    </button>
  );
};

export const LiAten = styled.li`
  list-style-image: linear-gradient(to left bottom, #f2fc20, #1415b3);
  list-style-type: circle;
  /* list-style: url("img/ATEN.png"); */
`;
