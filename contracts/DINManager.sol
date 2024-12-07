// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DINManager contract
/// @notice This contract manages the disbursement of rewards to members that validate the data in DINs
contract DINManager {
    uint256 public constant MAX_SCORE = 100_000; // 100%

    struct DINProject {
        bool active;
        /// Address of the owner of the project
        address owner;

        /// Address of the contributors for the project
        address[] contributors;

        /// Address of the validators for the project
        address[] validators;

        /// True if the address is a contributor
        mapping(address => bool) isContributor;

        /// True if the address is a validator
        mapping(address => bool) isValidator;

        /// Address of the token used to reward the contributors and validators
        IERC20 rewardToken;

        /// Amount of tokens to reward the contributors
        uint256 contributorRewardAmount;

        /// Amount of tokens to reward the validators
        uint256 validatorRewardAmount;

        /// Deadline for validators to commit to a validation
        uint256 validationCommitmentDeadline;

        /// Deadline for validators to reveal their validation
        uint256 validationRevealDeadline;

        /// Commitments of the validators
        mapping(address => mapping(address => bytes32)) validationCommitments;

        /// Scores of the validators
        mapping(address => mapping(address => uint256)) scores;

        /// True if the validation has been revealed
        mapping(address => mapping(address => bool)) validationRevealed;

        /// Total score for each contributor
        mapping(address => uint256) contributorTotalScores;
        /// Number of scores provided for each contributor
        mapping(address => uint256) contributorNumScores;

        /// Total score for the project
        uint256 totalScore;

        // How many times a validator has successfully validated a contributor
        mapping(address => uint256) numSuccessfulValidations;

        // Total number of successful validations
        uint256 totalSuccessfulValidations;

        /// True if the validator has already collected the reward
        mapping(address => bool) collectedValidatorReward;

        /// True if the contributor has already collected the reward
        mapping(address => bool) collectedContributorReward;
    }

    mapping(uint256 => DINProject) public projects;
    uint256 public projectCount;

    function _computeHash(bytes32 _secret, uint256 _score) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret, _score));
    }

    /// @notice Creates a new DIN project
    function createProject() public {
        projects[projectCount].owner = msg.sender;
        projectCount++;
    }

    /// @notice Adds contributors to a project
    /// @param _projectId ID of the project
    /// @param _contributors Addresses of the contributors
    function addContributors(uint256 _projectId, address[] calldata _contributors) public {
        DINProject storage project = projects[_projectId];
        require(
            msg.sender == project.owner,
            "You are not authorized to add contributors"
        );
        require(
            !project.active,
            "Project is already active"
        );
        for (uint256 i = 0; i < _contributors.length; i++) {
            require(
                !project.isContributor[_contributors[i]],
                "Contributor already added"
            );
            project.isContributor[_contributors[i]] = true;
            project.contributors.push(_contributors[i]);
        }
    }

    /// @notice Adds validators to a project
    /// @param _projectId ID of the project
    /// @param _validators Addresses of the validators
    function addValidators(uint256 _projectId, address[] calldata _validators) public {
        DINProject storage project = projects[_projectId];
        require(
            msg.sender == project.owner,
            "You are not authorized to add validators"
        );
        require(
            !project.active,
            "Project is already active"
        );
        for (uint256 i = 0; i < _validators.length; i++) {
            require(
                !project.isValidator[_validators[i]],
                "Validator already added"
            );
            project.isValidator[_validators[i]] = true;
            project.validators.push(_validators[i]);
        }
    }

    /// @notice Starts a project
    /// @param _projectId ID of the project
    /// @param _rewardToken Address of the token used to reward the contributors and validators
    /// @param _contributorRewardAmount Amount of tokens to reward the contributors
    /// @param _validationRewardAmount Amount of tokens to reward the validators
    /// @param _validationCommitmentDeadline Deadline for validators to commit to a validation
    /// @param _validationRevealDeadline Deadline for validators to reveal their validation
    function startProject(
        uint256 _projectId,
        IERC20 _rewardToken,
        uint256 _contributorRewardAmount,
        uint256 _validationRewardAmount,
        uint256 _validationCommitmentDeadline,
        uint256 _validationRevealDeadline
    ) public {
        require(
            !projects[_projectId].active,
            "Project has already started"
        );
        require(
            msg.sender == projects[_projectId].owner,
            "You are not authorized to start the project"
        );
        require(
            projects[_projectId].validators.length > 0,
            "At least one validator is required"
        );
        require(
            projects[_projectId].contributors.length > 0,
            "At least one contributor is required"
        );
        require(
            _rewardToken.balanceOf(msg.sender) >= _contributorRewardAmount + _validationRewardAmount,
            "Insufficient balance"
        );
        require(
            _validationCommitmentDeadline > block.timestamp,
            "Commitment deadline must be in the future"
        );
        require(
            _validationRevealDeadline > _validationCommitmentDeadline,
            "Reveal deadline must be after commitment deadline"
        );
        require(
            _contributorRewardAmount > 0 && _validationRewardAmount > 0,
            "Rewards must be positive"
        );

        projects[_projectId].active = true;
        projects[_projectId].rewardToken = _rewardToken;
        projects[_projectId].contributorRewardAmount = _contributorRewardAmount;
        projects[_projectId].validatorRewardAmount = _validationRewardAmount;
        projects[_projectId].validationCommitmentDeadline = _validationCommitmentDeadline;
        projects[_projectId].validationRevealDeadline = _validationRevealDeadline;


        // Transfer the reward amount to the contract
        _rewardToken.transferFrom(msg.sender, address(this), _contributorRewardAmount + _validationRewardAmount);
    }

    /// ====== Getters ======

    /// @notice Returns the information of a project
    /// @param _projectId ID of the project
    /// @return owner Address of the owner of the project
    /// @return active True if the project is active (started)
    /// @return rewardToken Address of the token used to reward the contributors and validators
    /// @return contributorRewardAmount Amount of tokens to reward the contributors
    /// @return validatorRewardAmount Amount of tokens to reward the validators
    /// @return validationCommitmentDeadline Deadline for validators to commit to a validation
    /// @return validationRevealDeadline Deadline for validators to reveal their validation
    /// @return numContributors Total number of contributors
    /// @return numValidators Total number of validators
    /// @return totalScore Total score for the project
    /// @return totalSuccessfulValidations Total number of successful validations
    function projectInfo(uint256 _projectId) external view returns (address owner, bool active, IERC20 rewardToken, uint256 contributorRewardAmount, uint256 validatorRewardAmount, uint256 validationCommitmentDeadline, uint256 validationRevealDeadline, uint256 numContributors, uint256 numValidators, uint256 totalScore, uint256 totalSuccessfulValidations) {
        DINProject storage project = projects[_projectId];
        return (
            project.owner,
            project.active,
            project.rewardToken,
            project.contributorRewardAmount,
            project.validatorRewardAmount,
            project.validationCommitmentDeadline,
            project.validationRevealDeadline,
            project.contributors.length,
            project.validators.length,
            project.totalScore,
            project.totalSuccessfulValidations
        );
    }

    /// @notice Returns the contributor at the given index
    /// @param _projectId ID of the project
    /// @param _index Index of the contributor
    /// @return Address of the contributor
    function getContributor(uint256 _projectId, uint256 _index) external view returns (address) {
        return projects[_projectId].contributors[_index];
    }

    /// @notice Returns the validator at the given index
    /// @param _projectId ID of the project
    /// @param _index Index of the validator
    /// @return Address of the validator
    function getValidator(uint256 _projectId, uint256 _index) external view returns (address) {
        return projects[_projectId].validators[_index];
    }

    /// @notice True if the address is a contributor
    /// @param _projectId ID of the project
    /// @param _address Address to check
    /// @return True if the address is a contributor
    function isContributor(uint256 _projectId, address _address) external view returns (bool) {
        return projects[_projectId].isContributor[_address];
    }

    /// @notice True if the address is a validator
    /// @param _projectId ID of the project
    /// @param _address Address to check
    /// @return True if the address is a validator
    function isValidator(uint256 _projectId, address _address) external view returns (bool) {
        return projects[_projectId].isValidator[_address];
    }

    /// @notice Returns the commitment of a validator for a contributor
    /// @param _projectId ID of the project
    /// @param _validator Address of the validator
    /// @param _contributor Address of the contributor
    /// @return Commitment of the validator
    function validationCommitment(uint256 _projectId, address _validator, address _contributor) external view returns (bytes32) {
        return projects[_projectId].validationCommitments[_validator][_contributor];
    }

    /// @notice Returns the score of a validator for a contributor
    /// @param _projectId ID of the project
    /// @param _validator Address of the validator
    /// @param _contributor Address of the contributor
    /// @return Score of the validator
    function score(uint256 _projectId, address _validator, address _contributor) external view returns (uint256) {
        return projects[_projectId].scores[_validator][_contributor];
    }

    /// @notice True if the validation has been revealed
    /// @param _projectId ID of the project
    /// @param _validator Address of the validator
    /// @param _contributor Address of the contributor
    /// @return True if the validation has been revealed
    function validationRevealed(uint256 _projectId, address _validator, address _contributor) external view returns (bool) {
        return projects[_projectId].validationRevealed[_validator][_contributor];
    }

    /// @notice Returns the total score of a contributor
    /// @param _projectId ID of the project
    /// @param _contributor Address of the contributor
    /// @return Total score of the contributor
    function contributorTotalScore(uint256 _projectId, address _contributor) external view returns (uint256) {
        return projects[_projectId].contributorTotalScores[_contributor];
    }

    /// @notice Returns the number of scores provided for a contributor
    /// @param _projectId ID of the project
    /// @param _contributor Address of the contributor
    /// @return Number of scores provided by the contributor
    function contributorNumScores(uint256 _projectId, address _contributor) external view returns (uint256) {
        return projects[_projectId].contributorNumScores[_contributor];
    }

    /// @notice Returns the number of successful validations of a validator
    /// @param _projectId ID of the project
    /// @param _validator Address of the validator
    /// @return Number of successful validations of the validator
    function numSuccessfulValidations(uint256 _projectId, address _validator) external view returns (uint256) {
        return projects[_projectId].numSuccessfulValidations[_validator];
    }

    /// @notice Returns true if the validator has already collected the reward
    /// @param _projectId ID of the project
    /// @param _validator Address of the validator
    /// @return True if the validator has already collected the reward
    function collectedValidatorReward(uint256 _projectId, address _validator) external view returns (bool) {
        return projects[_projectId].collectedValidatorReward[_validator];
    }

    /// @notice Returns true if the contributor has already collected the reward
    /// @param _projectId ID of the project
    /// @param _contributor Address of the contributor
    /// @return True if the contributor has already collected the reward
    function collectedContributorReward(uint256 _projectId, address _contributor) external view returns (bool) {
        return projects[_projectId].collectedContributorReward[_contributor];
    }

    /// =====================

    /// @notice Commits to validations for a project
    /// @dev It is possible to update the commitment until the commitment deadline
    /// @param _projectId ID of the project
    /// @param _contributors Addresses of the contributors
    /// @param _commitments Commitments of the validator
    function commitValidations(uint256 _projectId, address[] calldata _contributors, bytes32[] calldata _commitments) public {
        DINProject storage project = projects[_projectId];

        require(
            project.active,
            "Project is not active"
        );
        require(
            block.timestamp <= project.validationCommitmentDeadline,
            "Validation commitment deadline has passed"
        );
        require(
            project.isValidator[msg.sender],
            "You are not authorized to commit a validation"
        );
        require(
            _contributors.length == _commitments.length,
            "Number of commitments must match number of contributors"
        );
        for (uint256 i = 0; i < _contributors.length; i++) {
            project.validationCommitments[msg.sender][_contributors[i]] = _commitments[i];
        }
    }

    /// @notice Reveals the validations for a project
    /// @param _projectId ID of the project
    /// @param _contributors Addresses of the contributors
    /// @param _secrets Secrets of the validator
    /// @param _scores Scores of the validator
    function revealValidations(uint256 _projectId, address[] calldata _contributors, bytes32[] calldata _secrets, uint256[] calldata _scores) public {
        DINProject storage project = projects[_projectId];

        require(
            project.active,
            "Project is not active"
        );
        require(
            block.timestamp <= project.validationRevealDeadline,
            "Validation reveal deadline has passed"
        );
        require(
            project.isValidator[msg.sender],
            "You are not authorized to reveal a validation"
        );
        require(
            _contributors.length == _secrets.length && _secrets.length == _scores.length,
            "Invalid input"
        );

        for (uint256 i = 0; i < _contributors.length; i++) {
            require(
                project.validationCommitments[msg.sender][_contributors[i]] != 0,
                "No commitment found"
            );
            require(
                !project.validationRevealed[msg.sender][_contributors[i]],
                "Score already revealed"
            );
            require(
                _scores[i] <= MAX_SCORE,
                "Invalid score"
            );
            require(
                project.isContributor[_contributors[i]],
                "Invalid contributor"
            );

            // Check that the commitment is correct
            require(
                project.validationCommitments[msg.sender][_contributors[i]] == _computeHash(_secrets[i], _scores[i]),
                "Invalid reveal"
            );

            project.scores[msg.sender][_contributors[i]] = _scores[i];
            project.validationRevealed[msg.sender][_contributors[i]] = true;
            project.contributorTotalScores[_contributors[i]] += _scores[i];
            project.contributorNumScores[_contributors[i]]++;
            project.totalScore += _scores[i];
        }
        project.numSuccessfulValidations[msg.sender] += _contributors.length;
        project.totalSuccessfulValidations += _contributors.length;
    }

    /// @notice Collects the reward for a validator
    /// @param _projectId ID of the project
    function collectValidatorReward(uint256 _projectId) public {
        DINProject storage project = projects[_projectId];

        require(
            project.active,
            "Project is not active"
        );
        require(
            block.timestamp > project.validationRevealDeadline,
            "Disbursement date has not been reached"
        );
        require(
            project.isValidator[msg.sender],
            "You are not authorized to collect a reward"
        );
        require(
            !project.collectedValidatorReward[msg.sender],
            "Reward already collected"
        );
        require(
            project.numSuccessfulValidations[msg.sender] > 0,
            "You are not authorized to collect a reward"
        );

        uint256 rewardAmount = project.validatorRewardAmount * project.numSuccessfulValidations[msg.sender] / project.totalSuccessfulValidations;

        project.rewardToken.transfer(msg.sender, rewardAmount);
        project.collectedValidatorReward[msg.sender] = true;
    }

    /// @notice Collects the reward for a contributor
    /// @param _projectId ID of the project
    function collectContributorReward(uint256 _projectId) public {
        DINProject storage project = projects[_projectId];

        require(
            project.active,
            "Project is not active"
        );
        require(
            block.timestamp > project.validationRevealDeadline,
            "Disbursement date has not been reached"
        );
        require(
            project.isContributor[msg.sender],
            "You are not authorized to collect a reward"
        );
        require(
            project.contributorTotalScores[msg.sender] > 0,
            "No reward"
        );
        require(
            !project.collectedContributorReward[msg.sender],
            "Reward already collected"
        );


        // The score assuming that all inactive validators would have given the same average score is
        // contributorScore = project.contributorTotalScores[msg.sender] / project.contributorNumScores[msg.sender] * project.contributors.length;
        // The overall score assuming that all inactive validators would have given the average score is
        // overallScore = project.validators.length * project.contributors.length * project.totalScore / project.totalSuccessfulValidations;
        // Dividing contributorScore by overallScore and multiplying by the total reward amount gives the reward amount for the contributor
        uint256 rewardAmount = project.contributorRewardAmount * (
            project.contributorTotalScores[msg.sender] * project.totalSuccessfulValidations
        ) / (
            project.contributorNumScores[msg.sender] * project.validators.length * project.totalScore
        );
        project.collectedContributorReward[msg.sender] = true;

        project.rewardToken.transfer(msg.sender, rewardAmount);
    }

}