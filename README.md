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

Add configuration under the `storageLayoutDiff` key:

| option    | description                                                                                                | default                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `path`    | path to HTML export directory (relative to Hardhat root)                                                   | `'./storage_layout'`                                           |
| `clear`   | whether to delete old output in `path` on output generation                                                | `false`                                                        |
| `flat`    | whether to flatten output directory (may cause name collisions)                                            | `false`                                                        |
| `only`    | `Array` of `String` matchers used to select included contracts, defaults to all contracts if `length` is 0 | `['^contracts/']` (dependent on Hardhat `paths` configuration) |
| `except`  | `Array` of `String` matchers used to exclude contracts                                                     | `[]`                                                           |
| `spacing` | number of spaces per indentation level of formatted output                                                 | `2`                                                            |

Export storage layouts:

```bash
npx hardhat export-storage-layout
# or
yarn run hardhat export-storage-layout
```

Compare two contracts:

```bash
npx hardhat diff-storage-layout [CONTRACT_A_FULLY_QUALIFIED_NAME] [CONTRACT_B_FULLY_QUALIFIED_NAME]
# or
yarn run hardhat diff-storage-layout [CONTRACT_A_FULLY_QUALIFIED_NAME] [CONTRACT_B_FULLY_QUALIFIED_NAME]
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
