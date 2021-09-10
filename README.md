# Hardhat Storage Layout Diff

Inspect and compare Solidity smart contract storage layouts.

## Installation

```bash
yarn add --dev hardhat-storage-layout-diff
```

## Usage

Load plugin in Hardhat config:

```javascript
require('hardhat-storage-layout-diff');
```

Run the included Hardhat task:

```bash
yarn run hardhat storage-layout-diff --a [CONTRACT_A_FULLY_QUALIFIED_NAME] --b [CONTRACT_B_FULLY_QUALIFIED_NAME]
```

Include the optional `--a-ref` and/or `--b-ref` arguments to specify the git reference where contracts `a` and `b` are defined, respectively.
