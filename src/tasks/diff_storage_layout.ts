import {
  getCollatedStorageLayout,
  mergeCollatedSlots,
  printMergedCollatedSlots,
} from '../lib/storage_layout_diff.js';
import { TASK_DIFF_STORAGE_LAYOUT } from '../task_names.js';
import { task } from 'hardhat/config';

export default task(TASK_DIFF_STORAGE_LAYOUT)
  .addPositionalArgument({
    name: 'a',
    description: 'First contract whose storage layout to inspect',
  })
  .addPositionalArgument({
    name: 'b',
    description: 'Second contract whose storage layout to inspect',
  })
  .addOption({
    name: 'aRef',
    description: 'Git reference where contract A is defined',
    defaultValue: '',
  })
  .addOption({
    name: 'bRef',
    description: 'Git reference where contract B is defined',
    defaultValue: '',
  })
  .setAction(async (args, hre) => {
    // TODO: import task name constant
    await hre.tasks.getTask('compile').run();

    const slotsA = await getCollatedStorageLayout(hre, args.a, args.aRef);
    const slotsB = await getCollatedStorageLayout(hre, args.b, args.bRef);

    const slots = mergeCollatedSlots(slotsA, slotsB);

    printMergedCollatedSlots(slots);
  })
  .build();
