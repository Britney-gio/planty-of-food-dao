import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("POFGovernanceDAO", async function () {

    it("Should deploy POFToken, POFTreasury and POFGovernanceDAO", async function () {
        const { ethers } = await network.connect();
        const [ owner, Giorgia ] = await ethers.getSigners();    
        // Deploy smart contract POFToken
        const POFToken = await ethers.getContractFactory("POFToken");
        const pofToken = await POFToken.deploy(
            ethers.parseEther("1000000")
        );
        // Deploy smart contract POFTreasury
        const POFTreasury = await ethers.getContractFactory("POFTreasury");
        const treasury = await POFTreasury.deploy(
            await pofToken.getAddress(),
            owner.address
        );
        // Deploy smart contract POFGovernanceDAO
        const POFGovernanceDAO = await ethers.getContractFactory("POFGovernanceDAO");
        const governanceDAO = await POFGovernanceDAO.deploy(
            await pofToken.getAddress(),
            await treasury.getAddress(),
            ethers.parseEther("10"),
            owner.address
        );
        // Set governanceDAO address in treasury contract
        await treasury.setGovernanceDAO(await governanceDAO.getAddress());

        assert.ok(await pofToken.getAddress());
        assert.ok(await treasury.getAddress());
        assert.ok(await governanceDAO.getAddress()); 

        await pofToken.transfer( 
            Giorgia.address, 
            ethers.parseEther("100")
        );
        await pofToken.connect(Giorgia).approve(
            await governanceDAO.getAddress(), 
            ethers.parseEther("100")
        );
        await governanceDAO.connect(Giorgia).buyShares(5);
        const GiorgiaShares = await governanceDAO.shares(Giorgia.address);
        assert.equal(GiorgiaShares, 5n);
        const isGiorgiaMember = await governanceDAO.isMember(Giorgia.address);
        assert.equal(isGiorgiaMember, true);
        const treasuryBalance = await pofToken.balanceOf(await treasury.getAddress());
        assert.equal(treasuryBalance, ethers.parseEther("50"));
    })




});