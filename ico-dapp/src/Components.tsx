import styled from "styled-components";

import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";

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
