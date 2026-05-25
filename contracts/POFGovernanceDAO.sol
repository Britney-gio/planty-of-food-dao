// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { POFTreasury } from "./POFTreasury.sol";

contract POFGovernanceDAO is Ownable {
    IERC20 public immutable pofToken;
    POFTreasury public immutable treasury;

    uint256 public sharePrice;
    bool public isShareSaleActive;
    uint256 public proposalCount;

    mapping(address => uint256) public shares;
    mapping(address => bool) public isMember;
    mapping(address => address) public delegates;
    mapping(address => uint256) public delegatedShares;

    enum VoteChoice { 
        Against, 
        For,  
        Abstain  
    }

    struct Proposal {
        uint256 id;
        string title;
        string description;
        uint256 deadline;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool approved;
        bool executed;    
        bool isFinancialProposal;
        address recipient;
        uint256 amount;
    }

    mapping(uint256 => Proposal) public ledgerProposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    constructor (
        address _pofToken,
        address _treasury,
        uint256 _sharePrice,
        address initialOwner
    ) Ownable (initialOwner) {
        require(_pofToken != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_sharePrice > 0, "Share price must be greater than zero");
        require(initialOwner != address(0), "Invalid owner address");

        pofToken = IERC20(_pofToken);
        treasury = POFTreasury(_treasury);
        sharePrice = _sharePrice;
        isShareSaleActive = true;
    }

    event SharesPurchased( 
        address indexed buyer,
        uint256 amount,
        uint256 totalCost
    );

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed creator,
        string title,
        bool isFinancialProposal
    );

    event MemberVoted(
        uint256 indexed proposalId,
        address indexed voter,
        VoteChoice choice,
        uint256 votingPower
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        bool approved,
        bool isFinancialProposal
    );

    modifier onlyMember() {
        require(isMember[msg.sender], "Only DAO members can call this function");
        _;
    }

    // Allow users to buy DAO shares using POF tokens
    function buyShares(uint256 amount) external {
        require(isShareSaleActive, "Share sale is closed");
        require(amount > 0, "Amount must be greater than zero");
        uint256 totalCost = amount * sharePrice;

        bool success = pofToken.transferFrom(
            msg.sender,
            address(treasury),
            totalCost
        );
        require(success, "Token transfer failed");

        shares[msg.sender] += amount;
        isMember[msg.sender] = true;
        if (delegates[msg.sender] != address(0)) {
            delegatedShares[delegates[msg.sender]] += amount;
        }
        emit SharesPurchased(msg.sender, amount, totalCost);
    }

    // Owner can close the share sale
    function closeShareSale() external onlyOwner {
        isShareSaleActive = false;
    }

    // Create a governance proposal without financial fund transfer
    function createGovernanceProposal(
        string calldata title,
        string calldata description,
        uint256 durationInDays
    ) external onlyMember {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(durationInDays > 0, "Duration must be greater than zero");

        uint256 proposalId = proposalCount++;
        Proposal storage newProposal = ledgerProposals[proposalId];

        newProposal.id = proposalId;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.deadline = block.timestamp + (durationInDays * 1 days);
        newProposal.isFinancialProposal = false;

        emit ProposalCreated(proposalId, msg.sender, title, false);
    }

    // Creates a financial proposal that can transfer Treasury funds if approved
    function createFinancialProposal(
        string calldata title,
        string calldata description,
        uint256 durationInDays,
        address recipient,
        uint256 amount
    ) external onlyMember {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(durationInDays > 0, "Duration must be greater than zero");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than zero");

        uint256 proposalId = proposalCount++;
        Proposal storage newProposal = ledgerProposals[proposalId];

        newProposal.id = proposalId;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.deadline = block.timestamp + (durationInDays * 1 days);
        newProposal.isFinancialProposal = true;
        newProposal.recipient = recipient;
        newProposal.amount = amount;

        emit ProposalCreated(proposalId, msg.sender, title, true);
    }

    // Allows a member to delegate their voting power to another DAO member
    function delegateVote(address memberDelegate) external onlyMember {
        require(memberDelegate != address(0), "Invalid address");
        require(memberDelegate != msg.sender, "Cannot delegate yourself");
        require(isMember[memberDelegate], "Delegate must be a DAO member");
        require(delegates[msg.sender] == address(0), "Vote already delegated");
        delegates[msg.sender] = memberDelegate;
        delegatedShares[memberDelegate] += shares[msg.sender];
    }

    // Allows members to vote with direct and delegated voting power
    function vote(uint256 proposalId, VoteChoice choice) external onlyMember {
        require(proposalId < proposalCount, "Proposal does not exist");
        require(block.timestamp <= ledgerProposals[proposalId].deadline, "Voting period has ended");
        require(!hasVoted[proposalId][msg.sender], "Member has already voted");
        require(shares[msg.sender] > 0, "Member has no voting power");
        require(delegates[msg.sender] == address(0), "Delegated members cannot vote directly");
        uint256 votingPower = shares[msg.sender] + delegatedShares[msg.sender];
        if (choice == VoteChoice.For) {
            ledgerProposals[proposalId].forVotes += votingPower;
        } else if (choice == VoteChoice.Against) {
            ledgerProposals[proposalId].againstVotes += votingPower;
        } else if (choice == VoteChoice.Abstain) {
            ledgerProposals[proposalId].abstainVotes += votingPower;
        }
        hasVoted[proposalId][msg.sender] = true;

        emit MemberVoted(proposalId, msg.sender, choice, votingPower);
    }    

    // Executes a proposal after the voting deadline and triggers Treasury transfers when needed
    function executeProposal(uint256 proposalId) external {
        require(proposalId < proposalCount, "Proposal does not exist");
        Proposal storage proposal = ledgerProposals[proposalId];
        require(block.timestamp > proposal.deadline, "Voting period is still active");
        require(!proposal.executed, "Proposal already executed");
        if (proposal.forVotes > proposal.againstVotes) {
            proposal.approved = true;
        }
        proposal.executed = true;
        if (proposal.approved && proposal.isFinancialProposal) {
            treasury.transferFunds(proposal.recipient, proposal.amount);
        }
        emit ProposalExecuted(
            proposalId,
            proposal.approved,
            proposal.isFinancialProposal
        );
    }
}