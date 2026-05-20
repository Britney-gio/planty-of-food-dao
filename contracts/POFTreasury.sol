// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract POFTreasury is Ownable {
    IERC20 public immutable pofToken;
    address public governanceDAO;

    constructor(address _pofToken, address initialOwner) Ownable(initialOwner) {
        pofToken = IERC20(_pofToken);
        require(_pofToken != address(0), "Invalid token address");
        require(initialOwner != address(0), "Invalid owner address");
    }

    event TreasuryTransfer(
        address indexed recipient,
        uint256 amount
    );

    modifier onlyGovernanceDAO() {
        require(msg.sender == governanceDAO, "Not authorized");
        _;
    }

    function setGovernanceDAO(address _governanceDAO) external onlyOwner {
        require(_governanceDAO != address(0), "Invalid DAO address");
        governanceDAO = _governanceDAO;
    }

    function transferFunds(address recipient, uint256 amount) external onlyGovernanceDAO {
        require(recipient != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than zero");
        bool success = pofToken.transfer(recipient, amount);
        require(success, "Token transfer failed");
        emit TreasuryTransfer(recipient, amount);
    }
}