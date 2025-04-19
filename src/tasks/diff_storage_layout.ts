import {
  getCollatedStorageLayout,
  mergeCollatedSlots,
  printMergedCollatedSlots,
} from '../lib/storage_layout_diff';
import { TASK_DIFF_STORAGE_LAYOUT } from '../task_names';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { task } from 'hardhat/config';

task(TASK_DIFF_STORAGE_LAYOUT)
  .addPositionalParam('a', 'First contract whose storage layout to inspect')
  .addPositionalParam('b', 'Second contract whose storage layout to inspect')
  .addOptionalParam('aRef', 'Git reference where contract A is defined')
  .addOptionalParam('bRef', 'Git reference where contract B is defined')
  .setAction(async (args, hre) => {
    await hre.run(TASK_COMPILE);

    const slotsA = await getCollatedStorageLayout(hre, args.a, args.aRef);
    const slotsB = await getCollatedStorageLayout(hre, args.b, args.bRef);

    const slots = mergeCollatedSlots(slotsA, slotsB);

    printMergedCollatedSlots(slots);
  });
