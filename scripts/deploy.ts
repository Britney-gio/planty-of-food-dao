import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy POFToken
  const POFToken = await ethers.getContractFactory("POFToken");
  const pofToken = await POFToken.deploy(ethers.parseEther("1000000"));

  await pofToken.waitForDeployment();
  console.log("POFToken deployed to:", await pofToken.getAddress());

  // Deploy POFTreasury
  const POFTreasury = await ethers.getContractFactory("POFTreasury");
  const treasury = await POFTreasury.deploy(
    await pofToken.getAddress(),
    deployer.address,
  );
  await treasury.waitForDeployment();
  console.log("POFTreasury deployed to:", await treasury.getAddress());

  // Deploy POFGovernanceDAO
  const POFGovernanceDAO = await ethers.getContractFactory("POFGovernanceDAO");
  const governanceDAO = await POFGovernanceDAO.deploy(
    await pofToken.getAddress(),
    await treasury.getAddress(),
    ethers.parseEther("10"),
    deployer.address,
  );

  await governanceDAO.waitForDeployment();
  console.log(
    "POFGovernanceDAO deployed to:",
    await governanceDAO.getAddress(),
  );

  // Connect Treasury to Governance DAO
  await treasury.setGovernanceDAO(await governanceDAO.getAddress());
  console.log("Treasury connected to DAO");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
