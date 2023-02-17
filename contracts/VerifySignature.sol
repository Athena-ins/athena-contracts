// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/*  

How to Sign  
1. Create message to sign
2. Hash the message
3. Sign the hash  
4. Verify the signer on-chain
 
*/

contract VerifySignature {
  function recoverSigner(string calldata message_, bytes memory signature_)
    public
    pure
    returns (address)
  {
    bytes32 messageHash = keccak256(abi.encodePacked(message_));
    bytes32 ethSignedMessageHash = keccak256(
      abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
    );

    require(signature_.length == 65, "VS: invalid signature length");

    bytes32 r;
    bytes32 s;
    uint8 v;

    assembly {
      // first 32 bytes, after the length prefix
      r := mload(add(signature_, 32))
      // second 32 bytes
      s := mload(add(signature_, 64))
      // final byte (first byte of the next 32 bytes)
      v := byte(0, mload(add(signature_, 96)))
    }

    return ecrecover(ethSignedMessageHash, v, r, s);
  }
}
