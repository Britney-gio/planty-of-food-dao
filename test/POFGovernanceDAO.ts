import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("POFGovernanceDAO", async function () {

    it("Should deploy POFToken, POFTreasury and POFGovernanceDAO", async function () {
        const { ethers } = await network.connect();
        const [ owner] = await ethers.getSigners();    
        const POFToken = await ethers.getContractFactory("POFToken");
        const pofToken = await POFToken.deploy(
            ethers.parseEther("1000000")
        );
        const POFTreasury = await ethers.getContractFactory("POFTreasury");
        const treasury = await POFTreasury.deploy(
            await pofToken.getAddress(),
            owner.address
        );
        const POFGovernanceDAO = await ethers.getContractFactory("POFGovernanceDAO");
        const governanceDAO = await POFGovernanceDAO.deploy(
            await pofToken.getAddress(),
            await treasury.getAddress(),
            ethers.parseEther("10"),
            owner.address
        );
        await treasury.setGovernanceDAO(await governanceDAO.getAddress());
        assert.ok(await pofToken.getAddress());
        assert.ok(await treasury.getAddress());
        assert.ok(await governanceDAO.getAddress());
        
    

})
});