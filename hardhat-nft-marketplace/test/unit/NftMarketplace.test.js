const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Test", function () {
          let nftMarketplace, basicNft, deployer, player
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0
          beforeEach(async function () {
              // deployer = (await getNamedAccounts()).deployer
              // player = (await getNamedAccounts()).player
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplace = await ethers.getContract("NftMarketplace")
              basicNft = await ethers.getContract("BasicNft")
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
          })

          describe("listItem & buyItem", () => {
              it("lists and can be bought", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deplyoerProceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert(newOwner.toString() == player.address)
                  assert(deplyoerProceeds.toString() == PRICE.toString())
              })
              it("reverts listing if price is set as 0", async () => {
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, 0)
                  ).to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero()")
              })
              it("reverts listing if not approved", async () => {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace()")
              })
              it("should emit ItemListed", async () => {
                  expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  )
              })
              it("should revert if msg.value is lower than price", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: ethers.utils.parseEther("0.001"),
                      })
                  ).to.be.revertedWith(
                      `NftMarketplace__PriceNotMet("${basicNft.address.toString()}", ${TOKEN_ID.toString()}, ${PRICE.toString()})`
                  )
              })
              it("should emit ItemBought", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  expect(
                      await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit("ItemBought")
              })
              describe("cancelListing", () => {
                  it("should cancel listing", async () => {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                      assert.equal(
                          (await nftMarketplace.getListing(basicNft.address, TOKEN_ID)).toString(),
                          ["0", "0x0000000000000000000000000000000000000000"]
                      )
                  })
                  it("should emit ItemCanceled", async () => {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      expect(
                          await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                      ).to.emit("ItemCanceled")
                  })
              })
              describe("updateListing", () => {
                  it("should update listing", async () => {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      await nftMarketplace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          ethers.utils.parseEther("0.1")
                      )
                      const updatedPrice = (
                          await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                      ).price.toString()
                      assert.equal(updatedPrice, ethers.utils.parseEther("0.1"))
                  })
                  it("should emit ItemListed after updating", async () => {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      expect(
                          await nftMarketplace.updateListing(
                              basicNft.address,
                              TOKEN_ID,
                              ethers.utils.parseEther("0.1")
                          )
                      ).to.emit("ItemListed")
                  })
              })
              describe("withdrawProceeds", () => {
                  it("should revert if proceeds are null", async () => {
                      await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
                          "NftMarketplace__NoProceeds()"
                      )
                  })
                  it("withdraws proceeds", async () => {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                      await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                      const deployerProceedsBefore = await nftMarketplace.getProceeds(
                          deployer.address
                      )
                      const deployerBalanceBefore = await deployer.getBalance()
                      const txResponse = await nftMarketplace.withdrawProceeds()
                      const transactionReceipt = await txResponse.wait(1)
                      const { gasUsed, effectiveGasPrice } = transactionReceipt
                      const gasCost = gasUsed.mul(effectiveGasPrice)
                      const deployerBalanceAfter = await deployer.getBalance()

                      assert(
                          deployerBalanceAfter.add(gasCost).toString() ==
                              deployerProceedsBefore.add(deployerBalanceBefore).toString()
                      )
                  })
              })
          })
      })
