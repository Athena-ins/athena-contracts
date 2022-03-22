import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import styled from "styled-components";

const formatter = new Intl.NumberFormat("en-us", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const formatBalance = (balance: BigNumber | undefined, units = 18) =>
  formatter.format(
    parseFloat(formatUnits(balance ?? BigNumber.from("0"), units))
  );

export const Button = styled.button`
  :disabled {
    background: grey;
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
