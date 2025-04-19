import {
  collateStorageLayout,
  loadStorageLayout,
  mergeCollatedSlots,
} from '../lib/storage_layout_diff';
import { TASK_STORAGE_LAYOUT_CHECK } from '../task_names';
import { task } from 'hardhat/config';
import fs from 'node:fs';

task(TASK_STORAGE_LAYOUT_CHECK)
  .addParam('source', 'Path to storage layout JSON')
  .addParam('b', 'Contract to check against storage layout')
  .addOptionalParam('bRef', 'Git reference where contract B is defined')
  .setAction(async function ({ source, b, bRef }, hre) {
    const slotsA = collateStorageLayout(
      JSON.parse(fs.readFileSync(source, 'utf-8')),
    );
    const slotsB = await loadStorageLayout(hre, b, bRef);
    const data = mergeCollatedSlots(slotsA, slotsB);

    console.log(data);
  });
