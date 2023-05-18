const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
// const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs")
const { assert, expect } = require("chai")

const { ethers } = require("hardhat")
// const { beforeEach, it } = require("mocha")

// We define a fixture to reuse the same setup in every test.
// We use loadFixture to run this setup once, snapshot that state,
// and reset Hardhat Network to that snapshot in every test.
describe("Auction Unit Tests", function () {
    async function deployAuctionFixture() {
        // Contracts are deployed using the first signer/account by default
        const [deployer, bidder] = await ethers.getSigners()

        const auctionContract = await ethers.getContractFactory("Auction")
        const auction = await auctionContract.deploy()

        auction.deployed()
        return { auction, auctionContract, deployer, bidder }
    }
    describe("bidHigher function", function () {
        it("reverts when you don't pay enough", async () => {
            const { auction, deployer, bidder } = await loadFixture(deployAuctionFixture)

            const bidHigher = await auction.bidHigher({ value: 2 })
            await bidHigher.wait(1)

            await expect(auction.bidHigher({ value: 1 })).to.be.revertedWith("Auction__BidTooLow")
        })

        it("records bidder when they outbid", async () => {
            const { auction, deployer, bidder } = await loadFixture(deployAuctionFixture)

            await auction.connect(bidder).bidHigher({ value: 1 }) // Outbid the first bid with 3
            const contractBidder = await auction.getHigestBidder()
            assert.equal(bidder.address, contractBidder)
        })

        it("emits event on successful bid", async () => {
            const { auction, deployer, bidder } = await loadFixture(deployAuctionFixture)

            await expect(auction.connect(bidder).bidHigher({ value: 1 }))
                .to.emit(
                    // emits BidPlaced event if entered to index bidder(s) address
                    auction,
                    "BidPlaced"
                )
                .withArgs(bidder.address, 1)
        })
    })
    describe("withdraw", function () {
        it("doesn't let withdraw if not an owner", async () => {
            const { auction, deployer, bidder } = await loadFixture(deployAuctionFixture)

            await expect(auction.connect(bidder).withdraw()).to.be.revertedWith(
                // is reverted when called by not an owner
                "Ownable: caller is not the owner"
            )
        })
        it("withdraws successfully for owner", async () => {
            const { auction, deployer, bidder } = await loadFixture(deployAuctionFixture)

            let deployerBalance = await deployer.getBalance()
            await auction.connect(bidder).bidHigher({ value: ethers.utils.parseEther("111") })

            const tx = await auction.connect(deployer).withdraw()
            const txReceipt = await tx.wait()
            const gasUsed = txReceipt.gasUsed
            const txCost = gasUsed.mul(tx.gasPrice)

            let newDeployerBalance = await deployer.getBalance()
            expect(newDeployerBalance).to.equal(
                deployerBalance.add(ethers.utils.parseEther("111")).sub(txCost)
            )
        })
    })
    describe("getters", function () {
        it("returns the latest bid", async () => {
            const { auction, deployer, bidder } = await loadFixture(deployAuctionFixture)

            await auction.bidHigher({ value: 1 })
            await auction.bidHigher({ value: 2 })
            expect(await auction.getLastBid()).to.equal(2)
        })
        it("returns the highest bidder", async () => {
            const { auction, deployer, bidder } = await loadFixture(deployAuctionFixture)

            await auction.connect(deployer).bidHigher({ value: 1 })
            await auction.connect(bidder).bidHigher({ value: 2 })
            expect(await auction.getHigestBidder()).to.equal(bidder.address)
        })
    })
})
