import styled from "styled-components";

export const Button = styled.button`
  font-size: 0.75em;
  margin: 1em;
  padding: 0.25em;
  border-radius: 8px;
  border: 0;
  background: #2196f3;
  color: white;
  :disabled {
    background: grey;
  }
  /* Color the border and text with theme.main */
  &:hover:not([disabled]) {
    background-color: pink;
    cursor: pointer;
  }
`;
