import {
    time,
    loadFixture,
  } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const ethers = hre.ethers;

describe("DINManager", function () {
    let rewardToken : hre.ethers.Contract;
    before(async function() {
        const rewardTokenFactory = await ethers.getContractFactory("MockERC20");
        rewardToken = await rewardTokenFactory.deploy();
    })
    
    describe("deployment", function() {
        it("deploys the DIN contract", async function() {
            const DIN = await ethers.getContractFactory("DINManager");
            const din = await DIN.deploy();

            expect(await din.getAddress()).to.be.properAddress;
        })
    })
    describe("execution", function() {
        let din : hre.ethers.Contract;
        beforeEach(async function() {
            const DIN = await ethers.getContractFactory("DINManager");
            din = await DIN.deploy();
        })
        it("creates a DIN project", async function() {
            const [alice, bob, charlie, dave, ...others] = await ethers.getSigners();
            await din.connect(alice).createProject('Test Project 1');
            expect(await din.projectCount()).to.equal(1);
            expect((await din.projectInfo(0)).owner).to.equal(alice.address);
        })
        describe("project initialization", function() {
            beforeEach(async function() {
                const [alice, ...others] = await ethers.getSigners();
                await din.connect(alice).createProject('Test Project 2');
            })

            async function projectInfo(id: number) : Promise<any> {
                const rawResult = await din.projectInfo(id);

                const keys = ["owner", "name", "active", "rewardToken", "contributorRewardAmount", "validatorRewardAmount", "validationCommitmentDeadline", "validationRevealDeadline", "numContributors", "numValidators", "totalScore", "totalSuccessfulValidations"];

                const result : any = {}
                for (let i = 0; i < keys.length; i++) {
                    result[keys[i]] = rawResult[i];
                }

                return result;
            }

            it("adds contributors to a project", async function() {
                const [alice, bob, charlie, dave, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addContributors(0, [dave.address]);

                expect((await projectInfo(0)).numContributors).to.equal(3);
                expect(await din.getContributor(0, 0)).to.equal(bob.address);
                expect(await din.getContributor(0, 1)).to.equal(charlie.address);
                expect(await din.getContributor(0, 2)).to.equal(dave.address);

                expect(await din.isContributor(0, bob.address)).to.be.true;
                expect(await din.isContributor(0, charlie.address)).to.be.true;
                expect(await din.isContributor(0, dave.address)).to.be.true;
            })
            it("fails to add contributors to a project if not the owner", async function() {
                const [alice, bob, charlie, dave, ...others] = await ethers.getSigners();
                await expect(din.connect(bob).addContributors(0, [charlie.address])).to.be.revertedWith("You are not authorized to add contributors");
            })
            it("fails to add contributors to a project if the project does not exist", async function() {
                const [alice, bob, charlie, dave, ...others] = await ethers.getSigners();
                await expect(din.connect(alice).addContributors(1, [charlie.address])).to.be.revertedWith("You are not authorized to add contributors");
            })

            it("adds validators to a project", async function() {
                const [alice, bob, charlie, dave, ...others] = await ethers.getSigners();
                await din.connect(alice).addValidators(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address]);

                expect((await projectInfo(0)).numValidators).to.equal(3);
                expect(await din.getValidator(0, 0)).to.equal(bob.address);
                expect(await din.getValidator(0, 1)).to.equal(charlie.address);
                expect(await din.getValidator(0, 2)).to.equal(dave.address);

                expect(await din.isValidator(0, bob.address)).to.be.true;
                expect(await din.isValidator(0, charlie.address)).to.be.true;
                expect(await din.isValidator(0, dave.address)).to.be.true;
            })
            it("fails to add validators to a project if not the owner", async function() {
                const [alice, bob, charlie, dave, ...others] = await ethers.getSigners();
                await expect(din.connect(bob).addValidators(0, [charlie.address])).to.be.revertedWith("You are not authorized to add validators");
            })
            it("fails to add validators to a project if the project does not exist", async function() {
                const [alice, bob, charlie, dave, ...others] = await ethers.getSigners();
                await expect(din.connect(alice).addValidators(1, [charlie.address])).to.be.revertedWith("You are not authorized to add validators");
            })

            it("starts a project", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline);
                expect(await projectInfo(0)).to.deep.equal({
                    active: true,
                    name: 'Test Project 2',
                    owner: alice.address,
                    rewardToken: await rewardToken.getAddress(),
                    contributorRewardAmount: 1000,
                    validatorRewardAmount: 500,
                    validationCommitmentDeadline,
                    validationRevealDeadline,
                    numContributors: 2,
                    numValidators: 2,
                    totalScore: 0,
                    totalSuccessfulValidations: 0,
                })

                expect(await rewardToken.balanceOf(await din.getAddress())).to.equal(1500);
            })
            it("fails to start a project if not the owner", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(bob).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("You are not authorized to start the project");
            })
            it("fails to start a project if the project does not exist", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(alice).startProject(1, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("You are not authorized to start the project");
            })
            it("fails to start a project if the reward token has not been approved", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.reverted;
            })
            it("fails to start a project with an insufficient reward token balance", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1000);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.reverted;
            })
            it("fails to start a project with a commitment deadline in the past", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() - 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("Commitment deadline must be in the future");
            })
            it("fails to start a project with a reveal deadline in the past", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline - 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("Reveal deadline must be after commitment deadline");
            })
            it("fails to start a project with a reveal deadline before the commitment deadline", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline - 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("Reveal deadline must be after commitment deadline");
            })
            it("fails to start a project with a commitment deadline before the current time", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() - 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("Commitment deadline must be in the future");
            })
            it("fails to start a project with zero contributor reward amount", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 0, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("Rewards must be positive");
            })
            it("fails to start a project with zero validator reward amount", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 0, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("Rewards must be positive");
            })
            it("fails to start a project with zero contributors", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();

                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("At least one contributor is required");
            })
            it("fails to start a project with zero validators", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();

                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("At least one validator is required");
            })
            it("fails to start an already started project", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline);

                await expect(din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline)).to.be.revertedWith("Project has already started");
            })
        })

        describe("project execution", function() {
            beforeEach(async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                await din.connect(alice).createProject('Test Project 3');
                await din.connect(alice).addContributors(0, [bob.address, charlie.address]);
                await din.connect(alice).addValidators(0, [dave.address, eric.address]);

                await rewardToken.connect(alice).mint(1500);
                await rewardToken.connect(alice).approve(await din.getAddress(), 1500);

                const validationCommitmentDeadline = await time.latest() + 4000;
                const validationRevealDeadline = validationCommitmentDeadline + 2000;

                await din.connect(alice).startProject(0, await rewardToken.getAddress(), 1000, 500, validationCommitmentDeadline, validationRevealDeadline);
            })

            it("commits a score", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();
                
                // Hash using keccak256
                const encoder = new ethers.AbiCoder();
                const dataBob = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret1"), 10]);
                const dataCharlie = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret2"), 20]);

                const encodedBob = ethers.keccak256(dataBob);
                const encodedCharlie = ethers.keccak256(dataCharlie);

                await din.connect(dave).commitValidations(0, [bob.address, charlie.address], [encodedBob, encodedCharlie]);

                expect(await din.validationCommitment(0, dave.address, bob.address)).to.equal(encodedBob);
                expect(await din.validationCommitment(0, dave.address, charlie.address)).to.equal(encodedCharlie);
            })
            it("fails to commit without being a validator", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();

                const encoder = new ethers.AbiCoder();
                const dataBob = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret1"), 10]);
                const dataCharlie = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret2"), 20]);

                const encodedBob = ethers.keccak256(dataBob);
                const encodedCharlie = ethers.keccak256(dataCharlie);

                await expect(din.connect(alice).commitValidations(0, [bob.address, charlie.address], [encodedBob, encodedCharlie])).to.be.revertedWith("You are not authorized to commit a validation");
            })
            it("fails to commit to a non-existent project", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();

                const encoder = new ethers.AbiCoder();
                const dataBob = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret1"), 10]);
                const dataCharlie = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret2"), 20]);

                const encodedBob = ethers.keccak256(dataBob);
                const encodedCharlie = ethers.keccak256(dataCharlie);

                await expect(din.connect(dave).commitValidations(1, [bob.address, charlie.address], [encodedBob, encodedCharlie])).to.be.revertedWith("Project is not active");
            })
            it("fails to commit to a project that has not started", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();

                const newDIN = await ethers.getContractFactory("DINManager");
                const din = await newDIN.deploy();

                await din.connect(alice).createProject('Test Project 4');

                const encoder = new ethers.AbiCoder();
                const dataBob = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret1"), 10]);
                const dataCharlie = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret2"), 20]);

                const encodedBob = ethers.keccak256(dataBob);
                const encodedCharlie = ethers.keccak256(dataCharlie);

                await expect(din.connect(dave).commitValidations(0, [bob.address, charlie.address], [encodedBob, encodedCharlie])).to.be.revertedWith("Project is not active");
            })
            it("fails to commit with different number of contributors and commitments", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();

                const encoder = new ethers.AbiCoder();
                const dataBob = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret1"), 10]);
                const dataCharlie = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret2"), 20]);

                const encodedBob = ethers.keccak256(dataBob);
                const encodedCharlie = ethers.keccak256(dataCharlie);

                await expect(din.connect(dave).commitValidations(0, [bob.address], [encodedBob, encodedCharlie])).to.be.revertedWith("Number of commitments must match number of contributors");
            })
            it("fails to commit after the commitment deadline", async function() {
                const [alice, bob, charlie, dave, eric, ...others] = await ethers.getSigners();

                const encoder = new ethers.AbiCoder();
                const dataBob = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret1"), 10]);
                const dataCharlie = encoder.encode(["bytes32", "uint256"], [ethers.encodeBytes32String("Secret2"), 20]);

                const encodedBob = ethers.keccak256(dataBob);
                const encodedCharlie = ethers.keccak256(dataCharlie);

                await time.increase(5000);

                await expect(din.connect(dave).commitValidations(0, [bob.address, charlie.address], [encodedBob, encodedCharlie])).to.be.revertedWith("Validation commitment deadline has passed");
            })
        })
    })
})