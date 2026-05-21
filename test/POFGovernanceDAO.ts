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
        
        await treasury.setGovernanceDAO(await governanceDAO.getAddress());

        assert.ok(await pofToken.getAddress());
        assert.ok(await treasury.getAddress());
        assert.ok(await governanceDAO.getAddress()); 

        // TEST1: buy shares and check new member and treasury balance
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

        // TEST2 : create Governance Proposal and check proposal details
        await governanceDAO.connect(Giorgia).createGovernanceProposal(
            "Add new supplier",
            "Proposal to add a new organic supplier",
            7
        );
        const proposalCount = await governanceDAO.proposalCount();
        assert.equal(proposalCount, 1n);
        const governanceProposal = await governanceDAO.ledgerProposals(0);
        assert.equal(governanceProposal.id, 0n);
        assert.equal(governanceProposal.title, "Add new supplier");
        assert.equal(governanceProposal.description, "Proposal to add a new organic supplier");
        assert.equal(governanceProposal.isFinancialProposal, false);
        assert.equal(governanceProposal.executed, false);
        assert.equal(governanceProposal.approved, false);
        assert.ok(governanceProposal.deadline > 0n);

        // TEST3 : create Financial Proposal and check proposal details
        await governanceDAO.connect(Giorgia).createFinancialProposal(
            "Support local organic farmers",
            "Proposal to support local organic farmers with DAO funds",
            7,
            Giorgia.address,
            ethers.parseEther("20")
        );
        const updatedProposalCount = await governanceDAO.proposalCount();
        assert.equal(updatedProposalCount, 2n);
        const financialProposal = await governanceDAO.ledgerProposals(1);
        assert.equal(financialProposal.id, 1n);
        assert.equal(financialProposal.title, "Support local organic farmers");
        assert.equal(financialProposal.description, "Proposal to support local organic farmers with DAO funds");
        assert.equal(financialProposal.isFinancialProposal, true);
        assert.equal(financialProposal.recipient, Giorgia.address);
        assert.equal(financialProposal.amount, ethers.parseEther("20"));
        assert.equal(financialProposal.executed, false);
        assert.equal(financialProposal.approved, false);
        assert.ok(financialProposal.deadline > 0n);



    })





});