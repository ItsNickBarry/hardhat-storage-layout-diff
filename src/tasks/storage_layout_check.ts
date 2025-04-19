import { TASK_STORAGE_LAYOUT_CHECK } from '../task_names.js';
import { task } from 'hardhat/config';

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
  .setAction(import.meta.resolve('../actions/storage_layout_check.ts'))
  .build();
