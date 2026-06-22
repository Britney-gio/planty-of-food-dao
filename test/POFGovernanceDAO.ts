import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("POFGovernanceDAO", async function () {
  it("Should deploy POFToken, POFTreasury and POFGovernanceDAO", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia, alessandro] = await ethers.getSigners();
    // Deploy contracts
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

    // Prepare DAO members
    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken.transfer(alessandro.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await pofToken
      .connect(alessandro)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));

    // Buy DAO shares and verify membership and treasury balance
    await governanceDAO.connect(giorgia).buyShares(5);
    await governanceDAO.connect(alessandro).buyShares(2);
    const giorgiaShares = await governanceDAO.shares(giorgia.address);
    assert.equal(giorgiaShares, 5n);
    const alessandroShares = await governanceDAO.shares(alessandro.address);
    assert.equal(alessandroShares, 2n);
    const isGiorgiaMember = await governanceDAO.isMember(giorgia.address);
    assert.equal(isGiorgiaMember, true);
    const isAlessandroMember = await governanceDAO.isMember(alessandro.address);
    assert.equal(isAlessandroMember, true);
    const treasuryBalance = await pofToken.balanceOf(
      await treasury.getAddress(),
    );
    assert.equal(treasuryBalance, ethers.parseEther("70"));

    // Create and verify Governance Proposal
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

    // Create and verify Financial Proposal
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

    // Cast weights and verify votes
    await governanceDAO.connect(giorgia).vote(0, 1); // Giorgia votes FOR the first proposal
    await governanceDAO.connect(alessandro).vote(0, 0); // Alessandro votes AGAINST the first proposal
    const votedProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(votedProposal.forVotes, 5n);
    assert.equal(votedProposal.againstVotes, 2n);
    assert.equal(votedProposal.abstainVotes, 0n);
    const giorgiaHasVoted = await governanceDAO.hasVoted(0, giorgia.address);
    assert.equal(giorgiaHasVoted, true);
    const alessandroHasVoted = await governanceDAO.hasVoted(
      0,
      alessandro.address,
    );
    assert.equal(alessandroHasVoted, true);

    // Execute the first proposal and verify status
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
    // Deploy smart contract
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
    // Prepare DAO members
    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken.transfer(alessandro.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await pofToken
      .connect(alessandro)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    // Buy DAO shares with Against majority scenario
    await governanceDAO.connect(giorgia).buyShares(2);
    await governanceDAO.connect(alessandro).buyShares(5);
    const giorgiaShares = await governanceDAO.shares(giorgia.address);
    assert.equal(giorgiaShares, 2n);
    const alessandroShares = await governanceDAO.shares(alessandro.address);
    assert.equal(alessandroShares, 5n);
    const isGiorgiaMember = await governanceDAO.isMember(giorgia.address);
    assert.equal(isGiorgiaMember, true);
    const isAlessandroMember = await governanceDAO.isMember(alessandro.address);
    assert.equal(isAlessandroMember, true);
    const treasuryBalance = await pofToken.balanceOf(
      await treasury.getAddress(),
    );
    assert.equal(treasuryBalance, ethers.parseEther("70"));

    // Create and verify Governance Proposal
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

    // Cast weighted votes with AGAINST majority
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

    // Execute the rejected proposal
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await governanceDAO.executeProposal(0);
    const executedProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(executedProposal.executed, true);
    assert.equal(executedProposal.approved, false);
  });

  it("Should reject proposal when for and against votes are equal even with abstain votes", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia, alessandro, chiara] = await ethers.getSigners();
    const POFToken = await ethers.getContractFactory("POFToken");
    const pofToken = await POFToken.deploy(ethers.parseEther("1000000"));
    // Deploy smart contract
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

    // Prepare DAO members
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

    // Buy equal DAO shares for tie voting scenario
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

    // Create and verify Governance Proposal
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

    // Cast FOR, AGAINST and ABSTAIN votes
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

    // Execute the proposal and verify tie rejection
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await governanceDAO.executeProposal(0); // Execute the rejected proposal
    const executedProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(executedProposal.executed, true);
    assert.equal(executedProposal.approved, false); // Proposal is rejected because FOR is not greater than AGAINST
  });

  it("Should not allow a non-member to vote", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia, chiara] = await ethers.getSigners();
    const POFToken = await ethers.getContractFactory("POFToken");
    const pofToken = await POFToken.deploy(ethers.parseEther("1000000"));

    // Deploy smart
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

    // Prepare DAO members and non-members
    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await governanceDAO.connect(giorgia).buyShares(5);
    await governanceDAO
      .connect(giorgia)
      .createGovernanceProposal(
        "Add local vegan producer",
        "Proposal to add a new local vegan producer",
        7,
      );
    // Verify that non-member cannot vote
    await assert.rejects(
      governanceDAO.connect(chiara).vote(0, 1),
      /Only DAO members can call this function/,
    );
  });

  it("Should not allow double voting", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia] = await ethers.getSigners();

    // Deploy contracts
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

    // Prepare DAO member and create proposal
    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await governanceDAO.connect(giorgia).buyShares(5);
    await governanceDAO
      .connect(giorgia)
      .createGovernanceProposal(
        "Add new look to the website",
        "Proposal to renovate the POF website with a new design",
        7,
      );
    // Cast first vote
    await governanceDAO.connect(giorgia).vote(0, 1);
    const giorgiaHasVoted = await governanceDAO.hasVoted(0, giorgia.address);
    assert.equal(giorgiaHasVoted, true);
    // Verify that double voting is rejected
    await assert.rejects(
      governanceDAO.connect(giorgia).vote(0, 0),
      /Member has already voted/,
    );
  });

  it("Should not allow voting after proposal deadline", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia] = await ethers.getSigners();

    // Deploy contracts
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

    // Prepare DAO member and create Governance proposal
    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await governanceDAO.connect(giorgia).buyShares(5);
    await governanceDAO
      .connect(giorgia)
      .createGovernanceProposal(
        "Add new garden area in the office",
        "Proposal to create a new green garden area in the POF office to promote sustainability and well-being",
        7,
      );

    // Move blockchain time after proposal deadline
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);
    // Verify that late voting is rejected
    await assert.rejects(
      governanceDAO.connect(giorgia).vote(0, 1),
      /Voting period has ended/,
    );
  });

  it("Should allow delegated voting power", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia, alessandro] = await ethers.getSigners();

    // Deploy contracts
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

    // Prepare DAO members and create Governance proposal
    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await pofToken.transfer(alessandro.address, ethers.parseEther("100"));
    await pofToken
      .connect(alessandro)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));

    await governanceDAO.connect(giorgia).buyShares(3);
    await governanceDAO.connect(alessandro).buyShares(5);
    const giorgiaShares = await governanceDAO.shares(giorgia.address);
    assert.equal(giorgiaShares, 3n);
    const alessandroShares = await governanceDAO.shares(alessandro.address);
    assert.equal(alessandroShares, 5n);
    // Delegate Giorgia's voting power to Alessandro
    await governanceDAO.connect(giorgia).delegateVote(alessandro.address);
    const giorgiaDelegate = await governanceDAO.delegates(giorgia.address);
    assert.equal(giorgiaDelegate, alessandro.address);
    const alessandroDelegatedShares = await governanceDAO.delegatedShares(
      alessandro.address,
    );
    assert.equal(alessandroDelegatedShares, 3n);

    await governanceDAO
      .connect(alessandro)
      .createGovernanceProposal(
        "Expand local farmer partnerships",
        "Proposal to expand partnerships with local sustainable farmers",
        7,
      );
    // Cast vote using direct and delegated voting power
    await governanceDAO.connect(alessandro).vote(0, 1);
    const delegatedProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(delegatedProposal.forVotes, 8n);
    assert.equal(delegatedProposal.againstVotes, 0n);
    assert.equal(delegatedProposal.abstainVotes, 0n);
    // Verify that the delegating member cannot vote directly
    await assert.rejects(
      governanceDAO.connect(giorgia).vote(0, 1),
      /Delegated members cannot vote directly/,
    );
  });
  
  it("Should not allow circular delegation", async function () {
  const { ethers } = await network.connect();
  const [owner, giorgia, alessandro] = await ethers.getSigners();

  // Deploy contracts
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

  // Prepare DAO members
  await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
  await pofToken.transfer(alessandro.address, ethers.parseEther("100"));

  await pofToken
    .connect(giorgia)
    .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));

  await pofToken
    .connect(alessandro)
    .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));

  await governanceDAO.connect(giorgia).buyShares(3);
  await governanceDAO.connect(alessandro).buyShares(5);

  // Giorgia delegates to Alessandro
  await governanceDAO.connect(giorgia).delegateVote(alessandro.address);

  // Alessandro cannot delegate back to Giorgia
  await assert.rejects(
    governanceDAO.connect(alessandro).delegateVote(giorgia.address),
    /Delegate has already delegated/,
  );
});

  it("Should execute an approved financial proposal and transfer funds from Treasury", async function () {
    const { ethers } = await network.connect();
    const [owner, giorgia, alessandro] = await ethers.getSigners();

    // Deploy contracts
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

    // Prepare DAO members and create Financial proposal
    await pofToken.transfer(giorgia.address, ethers.parseEther("100"));
    await pofToken.transfer(alessandro.address, ethers.parseEther("100"));
    await pofToken
      .connect(giorgia)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));
    await pofToken
      .connect(alessandro)
      .approve(await governanceDAO.getAddress(), ethers.parseEther("100"));

    await governanceDAO.connect(giorgia).buyShares(5);
    await governanceDAO.connect(alessandro).buyShares(2);
    const treasuryBalance = await pofToken.balanceOf(
      await treasury.getAddress(),
    );
    assert.equal(treasuryBalance, ethers.parseEther("70"));
    const giorgiaBalanceBeforeFinancialExecution = await pofToken.balanceOf(
      giorgia.address,
    );
    assert.equal(
      giorgiaBalanceBeforeFinancialExecution,
      ethers.parseEther("50"),
    );

    await governanceDAO
      .connect(giorgia)
      .createFinancialProposal(
        "Support organic producers",
        "Proposal to support local organic producers with DAO funds",
        7,
        giorgia.address,
        ethers.parseEther("10"),
      );
    // Cast weighted votes to approve the financial proposal
    await governanceDAO.connect(giorgia).vote(0, 1);
    await governanceDAO.connect(alessandro).vote(0, 1);
    // Move blockchain time after proposal deadline and execute the approved financial proposal
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);
    await governanceDAO.executeProposal(0);
    const executedProposal = await governanceDAO.ledgerProposals(0);
    assert.equal(executedProposal.executed, true);
    assert.equal(executedProposal.approved, true);
    // Verify Treasury transfer execution
    const giorgiaBalanceAfterFinancialExecution = await pofToken.balanceOf(
      giorgia.address,
    );
    const treasuryBalanceAfter = await pofToken.balanceOf(
      await treasury.getAddress(),
    );

    assert.equal(
      giorgiaBalanceAfterFinancialExecution -
        giorgiaBalanceBeforeFinancialExecution,
      ethers.parseEther("10"),
    ); // Sum of funds transferred to Giorgia
    assert.equal(treasuryBalanceAfter, ethers.parseEther("60")); // Treasury balance after transferring funds to Giorgia
  });
});
