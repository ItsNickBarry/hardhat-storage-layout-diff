import {
  getCollatedStorageLayout,
  printCollatedSlots,
} from '../lib/storage_layout_diff.js';
import { TASK_INSPECT_STORAGE_LAYOUT } from '../task_names.js';
import { task } from 'hardhat/config';

export default task(TASK_INSPECT_STORAGE_LAYOUT)
  .addPositionalArgument({
    name: 'contract',
    description: 'Contract whose storage layout to inspect',
  })
  .setAction(async (args, hre) => {
    // TODO: import task name constant
    await hre.tasks.getTask('compile').run();

    const slots = await getCollatedStorageLayout(hre, args.contract);

    printCollatedSlots(slots);
  })
  .build();
