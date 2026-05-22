import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("POFGovernanceDAO", async function () {

  it("Should deploy POFToken, POFTreasury and POFGovernanceDAO", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia, alessandro] = await ethers.getSigners();
    // Deploy smart contract POFToken
    const POFToken = await ethers.getContractFactory("POFToken");
    const pofToken = await POFToken.deploy(ethers.parseEther("1000000"));
    // Deploy smart contract POFTreasury
    const POFTreasury = await ethers.getContractFactory("POFTreasury");
    const treasury = await POFTreasury.deploy(
      await pofToken.getAddress(),
      owner.address,
    );
    // Deploy smart contract POFGovernanceDAO
    const POFGovernanceDAO = await ethers.getContractFactory(
      "POFGovernanceDAO",
    );
    const governanceDAO = await POFGovernanceDAO.deploy(
      await pofToken.getAddress(),
      await treasury.getAddress(),
      ethers.parseEther("10"),
      owner.address,
    );

    await treasury.setGovernanceDAO(await governanceDAO.getAddress());

    assert.ok(await pofToken.getAddress());
    assert.ok(await treasury.getAddress());
    assert.ok(await governanceDAO.getAddress());

    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken.transfer(alessandro.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await pofToken
      .connect(alessandro)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));

    // TEST1: buy shares and check new member and treasury balance
    await governanceDAO.connect(giorgia).buyShares(5);
    await governanceDAO.connect(alessandro).buyShares(2);
    const GiorgiaShares = await governanceDAO.shares(giorgia.address);
    assert.equal(GiorgiaShares, 5n);
    const AlessandroShares = await governanceDAO.shares(alessandro.address);
    assert.equal(AlessandroShares, 2n);
    const isGiorgiaMember = await governanceDAO.isMember(giorgia.address);
    assert.equal(isGiorgiaMember, true);
    const isAlessandroMember = await governanceDAO.isMember(alessandro.address);
    assert.equal(isAlessandroMember, true);
    const treasuryBalance = await pofToken.balanceOf(
      await treasury.getAddress(),
    );
    assert.equal(treasuryBalance, ethers.parseEther("70"));

    // TEST2 : create Governance Proposal and check proposal details
    await governanceDAO
      .connect(giorgia)
      .createGovernanceProposal(
        "Add new supplier",
        "Proposal to add a new organic supplier",
        7,
      );
    const proposalCount = await governanceDAO.proposalCount();
    assert.equal(proposalCount, 1n);
    const governanceProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(governanceProposal.id, 0n);
    assert.equal(governanceProposal.title, "Add new supplier");
    assert.equal(
      governanceProposal.description,
      "Proposal to add a new organic supplier",
    );
    assert.equal(governanceProposal.isFinancialProposal, false);
    assert.equal(governanceProposal.executed, false);
    assert.equal(governanceProposal.approved, false);
    assert.ok(governanceProposal.deadline > 0n);

    // TEST3 : create Financial Proposal and check proposal details
    await governanceDAO
      .connect(giorgia)
      .createFinancialProposal(
        "Support local organic farmers",
        "Proposal to support local organic farmers with DAO funds",
        7,
        giorgia.address,
        ethers.parseEther("20"),
      );
    const updatedProposalCount = await governanceDAO.proposalCount();
    assert.equal(updatedProposalCount, 2n);
    const financialProposal = await governanceDAO.ledgerProposals(1);
    assert.equal(financialProposal.id, 1n);
    assert.equal(financialProposal.title, "Support local organic farmers");
    assert.equal(
      financialProposal.description,
      "Proposal to support local organic farmers with DAO funds",
    );
    assert.equal(financialProposal.isFinancialProposal, true);
    assert.equal(financialProposal.recipient, giorgia.address);
    assert.equal(financialProposal.amount, ethers.parseEther("20"));
    assert.equal(financialProposal.executed, false);
    assert.equal(financialProposal.approved, false);
    assert.ok(financialProposal.deadline > 0n);

    //  TEST4 : verify ponderation process and voting status
    await governanceDAO.connect(giorgia).vote(0, 1); // Giorgia votes FOR the first proposal
    await governanceDAO.connect(alessandro).vote(0, 0); // Alessandro votes AGAINST the first proposal
    const votedProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(votedProposal.forVotes, 5n);
    assert.equal(votedProposal.againstVotes, 2n);
    assert.equal(votedProposal.abstainVotes, 0n);
    const GiorgiaHasVoted = await governanceDAO.hasVoted(0, giorgia.address);
    assert.equal(GiorgiaHasVoted, true);
    const AlessandroHasVoted = await governanceDAO.hasVoted(
      0,
      alessandro.address,
    );
    assert.equal(AlessandroHasVoted, true);

    // TEST 5 : execute proposal
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await governanceDAO.executeProposal(0); // Execute the first proposal FOR
    const executedProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(executedProposal.executed, true);
    assert.equal(executedProposal.approved, true);
  });

  it("Should reject proposal when against votes are greater than for votes", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia, alessandro] = await ethers.getSigners();
    const POFToken = await ethers.getContractFactory("POFToken");
    const pofToken = await POFToken.deploy(ethers.parseEther("1000000"));
    // Deploy smart contract POFTreasury
    const POFTreasury = await ethers.getContractFactory("POFTreasury");
    const treasury = await POFTreasury.deploy(
      await pofToken.getAddress(),
      owner.address,
    );
    const POFGovernanceDAO = await ethers.getContractFactory(
      "POFGovernanceDAO",
    );
    const governanceDAO = await POFGovernanceDAO.deploy(
      await pofToken.getAddress(),
      await treasury.getAddress(),
      ethers.parseEther("10"),
      owner.address,
    );

    await treasury.setGovernanceDAO(await governanceDAO.getAddress());

    assert.ok(await pofToken.getAddress());
    assert.ok(await treasury.getAddress());
    assert.ok(await governanceDAO.getAddress());

    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken.transfer(alessandro.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await pofToken
      .connect(alessandro)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));

    // TEST: buy shares and check new member and treasury balance
    await governanceDAO.connect(giorgia).buyShares(2);
    await governanceDAO.connect(alessandro).buyShares(5);
    const GiorgiaShares = await governanceDAO.shares(giorgia.address);
    assert.equal(GiorgiaShares, 2n);
    const AlessandroShares = await governanceDAO.shares(alessandro.address);
    assert.equal(AlessandroShares, 5n);
    const isGiorgiaMember = await governanceDAO.isMember(giorgia.address);
    assert.equal(isGiorgiaMember, true);
    const isAlessandroMember = await governanceDAO.isMember(alessandro.address);
    assert.equal(isAlessandroMember, true);
    const treasuryBalance = await pofToken.balanceOf(
      await treasury.getAddress(),
    );
    assert.equal(treasuryBalance, ethers.parseEther("70"));

    // TEST : create Governance Proposal and check proposal details
    await governanceDAO
      .connect(giorgia)
      .createGovernanceProposal(
        "Add new supplier",
        "Proposal to evaluate a supplier that does not fully match POF sustainability criteria",
        7,
      );
    const proposalCount = await governanceDAO.proposalCount();
    assert.equal(proposalCount, 1n);
    const governanceProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(governanceProposal.id, 0n);
    assert.equal(governanceProposal.title, "Add new supplier");
    assert.equal(
      governanceProposal.description,
      "Proposal to evaluate a supplier that does not fully match POF sustainability criteria",
    );
    assert.equal(governanceProposal.isFinancialProposal, false);
    assert.equal(governanceProposal.executed, false);
    assert.equal(governanceProposal.approved, false);
    assert.ok(governanceProposal.deadline > 0n);

    await governanceDAO.connect(giorgia).vote(0, 1); // Giorgia votes FOR the proposal
    await governanceDAO.connect(alessandro).vote(0, 0); // Alessandro votes AGAINST the proposal

    const rejectedProposalAfterVotes = await governanceDAO.ledgerProposals(0);
    assert.equal(rejectedProposalAfterVotes.forVotes, 2n);
    assert.equal(rejectedProposalAfterVotes.againstVotes, 5n);
    assert.equal(rejectedProposalAfterVotes.abstainVotes, 0n);
    const giorgiaHasVoted = await governanceDAO.hasVoted(0, giorgia.address);
    assert.equal(giorgiaHasVoted, true);
    const alessandroHasVoted = await governanceDAO.hasVoted(
      0,
      alessandro.address,
    );
    assert.equal(alessandroHasVoted, true);

    // TEST : execute proposal and check that it is rejected
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await governanceDAO.executeProposal(0); // Execute the rejected proposal
    const executedProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(executedProposal.executed, true);
    assert.equal(executedProposal.approved, false);
  });

  it("Should reject proposal when for and against votes are equal even with abstain votes", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia, alessandro, chiara] = await ethers.getSigners();
    const POFToken = await ethers.getContractFactory("POFToken");
    const pofToken = await POFToken.deploy(ethers.parseEther("1000000"));
    // Deploy smart contract POFTreasury
    const POFTreasury = await ethers.getContractFactory("POFTreasury");
    const treasury = await POFTreasury.deploy(
      await pofToken.getAddress(),
      owner.address,
    );
    const POFGovernanceDAO = await ethers.getContractFactory(
      "POFGovernanceDAO",
    );
    const governanceDAO = await POFGovernanceDAO.deploy(
      await pofToken.getAddress(),
      await treasury.getAddress(),
      ethers.parseEther("10"),
      owner.address,
    );

    await treasury.setGovernanceDAO(await governanceDAO.getAddress());

    assert.ok(await pofToken.getAddress());
    assert.ok(await treasury.getAddress());
    assert.ok(await governanceDAO.getAddress());

    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken.transfer(alessandro.address, ethers.parseEther("100"));
    await pofToken.transfer(chiara.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await pofToken
      .connect(alessandro)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await pofToken
      .connect(chiara)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));

    // TEST: buy shares and check new member and treasury balance
    await governanceDAO.connect(giorgia).buyShares(3);
    await governanceDAO.connect(alessandro).buyShares(3);
    await governanceDAO.connect(chiara).buyShares(3);
    const giorgiaShares = await governanceDAO.shares(giorgia.address);
    assert.equal(giorgiaShares, 3n);
    const alessandroShares = await governanceDAO.shares(alessandro.address);
    assert.equal(alessandroShares, 3n);
    const chiaraShares = await governanceDAO.shares(chiara.address);
    assert.equal(chiaraShares, 3n);
    const isGiorgiaMember = await governanceDAO.isMember(giorgia.address);
    assert.equal(isGiorgiaMember, true);
    const isAlessandroMember = await governanceDAO.isMember(alessandro.address);
    assert.equal(isAlessandroMember, true);
    const isChiaraMember = await governanceDAO.isMember(chiara.address);
    assert.equal(isChiaraMember, true);
    const treasuryBalance = await pofToken.balanceOf(
      await treasury.getAddress(),
    );
    assert.equal(treasuryBalance, ethers.parseEther("90"));

    // TEST : create Governance Proposal and check proposal details
    await governanceDAO
      .connect(giorgia)
      .createGovernanceProposal(
        "New social media sponsorship",
        "Proposal to start a new spot for sponsoring POF on social media",
        7,
      );
    const proposalCount = await governanceDAO.proposalCount();
    assert.equal(proposalCount, 1n);
    const governanceProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(governanceProposal.id, 0n);
    assert.equal(governanceProposal.title, "New social media sponsorship");
    assert.equal(
      governanceProposal.description,
      "Proposal to start a new spot for sponsoring POF on social media",
    );
    assert.equal(governanceProposal.isFinancialProposal, false);
    assert.equal(governanceProposal.executed, false);
    assert.equal(governanceProposal.approved, false);
    assert.ok(governanceProposal.deadline > 0n);

    await governanceDAO.connect(giorgia).vote(0, 1); // Giorgia votes FOR the proposal
    await governanceDAO.connect(alessandro).vote(0, 0); // Alessandro votes AGAINST the proposal
    await governanceDAO.connect(chiara).vote(0, 2); // Chiara votes ABSTAIN the proposal

    const rejectedProposalAfterVoting = await governanceDAO.ledgerProposals(0);
    assert.equal(rejectedProposalAfterVoting.forVotes, 3n);
    assert.equal(rejectedProposalAfterVoting.againstVotes, 3n);
    assert.equal(rejectedProposalAfterVoting.abstainVotes, 3n);
    const giorgiaHasVoted = await governanceDAO.hasVoted(0, giorgia.address);
    assert.equal(giorgiaHasVoted, true);
    const alessandroHasVoted = await governanceDAO.hasVoted(
      0,
      alessandro.address,
    );
    assert.equal(alessandroHasVoted, true);
    const chiaraHasVoted = await governanceDAO.hasVoted(0, chiara.address);
    assert.equal(chiaraHasVoted, true);

    // TEST : execute proposal and check that it is rejected or approved
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await governanceDAO.executeProposal(0); // Execute the rejected proposal
    const executedProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(executedProposal.executed, true);
    assert.equal(executedProposal.approved, false); // forVotes is not greater than againstVotes
  });  

  it("Should not allow a non-member to vote", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia, chiara] = await ethers.getSigners();
    const POFToken = await ethers.getContractFactory("POFToken");
    const pofToken = await POFToken.deploy(ethers.parseEther("1000000"));
    // Deploy smart contract POFTreasury
    const POFTreasury = await ethers.getContractFactory("POFTreasury");
    const treasury = await POFTreasury.deploy(
      await pofToken.getAddress(),
      owner.address,
    );
    const POFGovernanceDAO = await ethers.getContractFactory("POFGovernanceDAO");
    const governanceDAO = await POFGovernanceDAO.deploy(
      await pofToken.getAddress(),
      await treasury.getAddress(),
      ethers.parseEther("10"),
      owner.address,
    );

    await treasury.setGovernanceDAO(await governanceDAO.getAddress());

    assert.ok(await pofToken.getAddress());
    assert.ok(await treasury.getAddress());
    assert.ok(await governanceDAO.getAddress());

    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await pofToken;
    await governanceDAO.connect(giorgia).buyShares(5);
    await governanceDAO
      .connect(giorgia)
      .createGovernanceProposal(
        "Add local vegan producer",
        "Proposal to add a new local vegan producer",
        7,
      );
    await assert.rejects(
      governanceDAO.connect(chiara).vote(0, 1),
      /Only DAO members can call this function/,
    );
  });

    it("Should not allow double voting", async function () {
      const { ethers } = await network.connect();
      const [owner, giorgia] = await ethers.getSigners();
      const POFToken = await ethers.getContractFactory("POFToken");
      const pofToken = await POFToken.deploy(ethers.parseEther("1000000"));
      const POFTreasury = await ethers.getContractFactory("POFTreasury");
      const treasury = await POFTreasury.deploy(
        await pofToken.getAddress(),
        owner.address,
      );
      const POFGovernanceDAO = await ethers.getContractFactory(
        "POFGovernanceDAO",
      );
      const governanceDAO = await POFGovernanceDAO.deploy(
        await pofToken.getAddress(),
        await treasury.getAddress(),
        ethers.parseEther("10"),
        owner.address,
      );

      await treasury.setGovernanceDAO(await governanceDAO.getAddress());

      assert.ok(await pofToken.getAddress());
      assert.ok(await treasury.getAddress());
      assert.ok(await governanceDAO.getAddress());

      await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
      await pofToken
        .connect(giorgia)
        .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
      await governanceDAO.connect(giorgia).buyShares(5);
      await governanceDAO
        .connect(giorgia)
        .createGovernanceProposal(
          "Add new look to the website",
          "Proposal to rinovate the POF website with a new design",
          7,
        );
      await governanceDAO.connect(giorgia).vote(0, 1); // Giorgia votes FOR the proposal
      const giorgiaHasVoted = await governanceDAO.hasVoted(0, giorgia.address);
      assert.equal(giorgiaHasVoted, true);
      await assert.rejects(
        governanceDAO.connect(giorgia).vote(0, 0),
        /Member has already voted/,
      );
    });

});


