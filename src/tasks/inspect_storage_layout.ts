import { TASK_INSPECT_STORAGE_LAYOUT } from '../task_names.js';
import { task } from 'hardhat/config';

export default task(TASK_INSPECT_STORAGE_LAYOUT)
  .addPositionalArgument({
    name: 'contract',
    description: 'Contract whose storage layout to inspect',
  })
  .setAction(import.meta.resolve('../actions/inspect_storage_layout.js'))
  .build();
