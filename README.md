# Hardhat Storage Layout Diff

Inspect and compare Solidity smart contract storage layouts.

## Installation

```bash
npm install --save-dev hardhat-storage-layout-diff
# or
yarn add --dev hardhat-storage-layout-diff
```

## Usage

Load plugin in Hardhat config:

```javascript
require('hardhat-storage-layout-diff');
```

Export storage layouts:

```bash
npx hardhat export-storage-layout
# or
yarn run hardhat export-storage-layout
```

Compare two contracts:

```bash
npx hardhat storage-layout-compare --a [CONTRACT_A_FULLY_QUALIFIED_NAME] --b [CONTRACT_B_FULLY_QUALIFIED_NAME]
# or
yarn run hardhat storage-layout-compare --a [CONTRACT_A_FULLY_QUALIFIED_NAME] --b [CONTRACT_B_FULLY_QUALIFIED_NAME]
```

Include the optional `--a-ref` and/or `--b-ref` arguments to specify the git reference where contracts `a` and `b` are defined, respectively.

Compare a contract to an exported JSON layout:

```bash
npx hardhat storage-layout-check --source [PATH_TO_LAYOUT_JSON] --b [CONTRACT_B_FULLY_QUALIFIED_NAME]
# or
yarn run hardhat storage-layout-check --source [PATH_TO_LAYOUT_JSON] --b [CONTRACT_B_FULLY_QUALIFIED_NAME]
```

## Development

Install dependencies via Yarn:

```bash
yarn install
```

Setup Husky to format code on commit:

```bash
yarn prepare
```
