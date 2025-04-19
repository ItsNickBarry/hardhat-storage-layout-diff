import {
  getStorageLayout,
  collateStorageLayout,
  mergeCollatedSlots,
  printMergedCollatedSlots,
} from '../lib/storage_layout_diff';
import { TASK_DIFF_STORAGE_LAYOUT } from '../task_names';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { task } from 'hardhat/config';

task(TASK_DIFF_STORAGE_LAYOUT)
  .addPositionalParam('a', 'First contract whose storage layout to inspect')
  .addPositionalParam('b', 'Second contract whose storage layout to inspect')
  .setAction(async (args, hre) => {
    await hre.run(TASK_COMPILE);

    const storageLayoutA = await getStorageLayout(hre, args.a);
    const slotsA = collateStorageLayout(storageLayoutA);
    const storageLayoutB = await getStorageLayout(hre, args.b);
    const slotsB = collateStorageLayout(storageLayoutB);

    const slots = mergeCollatedSlots(slotsA, slotsB);

    printMergedCollatedSlots(slots);
  });
