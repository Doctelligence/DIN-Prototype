# DIN Prototype

Prototype of reward disbursement for the DIN system. Uses a commit-and-reveal scheme for scoring by validators.

## Overview

There are three types of users:
- Owners: create projects and provide the reward
- Contributors: provide the data to train the model
- Validators: score contributors' data

The timeline of a project is as follows:
- The owner creates a project with `createProject`, and adds contributors and validators with `addContributors` and `addValidators`, respectively
- The owner starts the project with `startProject`. From that moment, validators can assign a score to each contributor until a specified deadline
- For each contributor, the validator first commits the salted hash of the score using `commitValidations`. Once the commitment deadline has passed, all validators reveal the salt and the score with `revealValidations`. Only reveals that correspond to the initial commitment are counted
- Contributors and validators receive rewards by calling `collectContributorReward` and `collectValidatorReward`. These rewards are taken from separate pools and use different distribution mechanisms.
  - Contributors receive a share of the total reward depending on the mean score assigned by the validators
  - Validators receive a share based on the number of valid reveals
 
The contract also features view methods for easier UI integration.

## Deploying

```
npm install
npm run test
```

## Testing

```
npm install
npm run test
```
