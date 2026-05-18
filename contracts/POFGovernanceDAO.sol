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
    }

    mapping(uint256 => Proposal) public ledgerProposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    constructor (
        address _pofToken,
        address _treasury,
        uint256 _sharePrice,
        address initialOwner
    ) Ownable (initialOwner) {
        pofToken = IERC20(_pofToken);
        treasury = POFTreasury(_treasury);
        sharePrice = _sharePrice;
        isShareSaleActive = true;
    }

    modifier onlyMember(){
        require(isMember[msg.sender], "Only DAO members can call this function");
        _;
    }

    function buyShares(uint256 amount) external {
        require(isShareSaleActive,"Share sale is closed");
        require(amount > 0, "Amount must be greater than zero");
        uint256 totalCost = amount * sharePrice;
        pofToken.transferFrom(msg.sender, address(treasury), totalCost);
        shares[msg.sender] += amount;
        isMember[msg.sender] = true;
    }

    function closeShareSale() external onlyOwner {
        isShareSaleActive = false;
    }

    function createProposal(
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
    }
    
}
