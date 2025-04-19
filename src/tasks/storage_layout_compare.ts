import {
  loadStorageLayout,
  mergeCollatedSlots,
} from '../lib/storage_layout_diff';
import { TASK_STORAGE_LAYOUT_COMPARE } from '../task_names';
import { task } from 'hardhat/config';

task(TASK_STORAGE_LAYOUT_COMPARE)
  .addParam('a', 'First contract to diff')
  .addParam('b', 'Second contract to diff')
  .addOptionalParam('aRef', 'Git reference where contract A is defined')
  .addOptionalParam('bRef', 'Git reference where contract B is defined')
  .setAction(async function ({ a, b, aRef, bRef }, hre) {
    const slotsA = await loadStorageLayout(hre, a, aRef);
    const slotsB = await loadStorageLayout(hre, b, bRef);
    const data = mergeCollatedSlots(slotsA, slotsB);

    console.log(data);
  });
