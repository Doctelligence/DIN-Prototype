import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DINManagerModule = buildModule("DINManagerModule", (m) => {
  const token = m.contract("DINManager");

  return { token };
});

export default DINManagerModule;
