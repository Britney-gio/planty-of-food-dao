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

    mapping(address => uint256) public shares;
    mapping(address => bool) public isMember;

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

    function buyShares(uint256 amount) external {
        require(isShareSaleActive,"Share sale is closed");
        require(amount > 0, "Amount must be greater than zero");
        uint256 totalCost = amount * sharePrice;
        pofToken.transferFrom(msg.sender, address(treasury), totalCost);
        shares[msg.sender] += amount;
        isMember[msg.sender] = true;
    }




}
