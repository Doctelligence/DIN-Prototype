import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MockERC20Module = buildModule("MockERC20Module", (m) => {
  const token = m.contract("MockERC20");

  return { token };
});

export default MockERC20Module;
