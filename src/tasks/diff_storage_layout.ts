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
  .setAction(import.meta.resolve('../actions/diff_storage_layout.js'))
  .build();
