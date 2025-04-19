import {
  collateStorageLayout,
  getCollatedStorageLayout,
  mergeCollatedSlots,
  printMergedCollatedSlots,
} from '../lib/storage_layout_diff.js';
import { TASK_STORAGE_LAYOUT_CHECK } from '../task_names.js';
import { task } from 'hardhat/config';
import fs from 'node:fs';

export default task(TASK_STORAGE_LAYOUT_CHECK)
  .addPositionalArgument({
    name: 'source',
    description: 'Path to storage layout JSON',
  })
  .addPositionalArgument({
    name: 'b',
    description: 'Contract to check against storage layout',
  })
  .addOption({
    name: 'bRef',
    description: 'Git reference where contract B is defined',
    defaultValue: '',
  })
  .setAction(async (args, hre) => {
    const slotsA = collateStorageLayout(
      JSON.parse(fs.readFileSync(args.source, 'utf-8')),
    );
    const slotsB = await getCollatedStorageLayout(hre, args.b, args.bRef);
    const data = mergeCollatedSlots(slotsA, slotsB);

    printMergedCollatedSlots(data);
  })
  .build();
