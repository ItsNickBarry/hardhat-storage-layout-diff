import {
  getCollatedStorageLayout,
  printCollatedSlots,
} from '../lib/storage_layout_diff';
import { TASK_INSPECT_STORAGE_LAYOUT } from '../task_names';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { task } from 'hardhat/config';

task(TASK_INSPECT_STORAGE_LAYOUT)
  .addPositionalParam('contract', 'Contract whose storage layout to inspect')
  .setAction(async (args, hre) => {
    await hre.run(TASK_COMPILE);

    const slots = await getCollatedStorageLayout(hre, args.contract);

    printCollatedSlots(slots);
  });
