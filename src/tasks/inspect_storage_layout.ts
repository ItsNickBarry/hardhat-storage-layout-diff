import {
  collateSlotEntries,
  getStorageLayout,
  visualizeSlot,
} from '../lib/storage_layout_diff';
import { TASK_INSPECT_STORAGE_LAYOUT } from '../task_names';
import Table from 'cli-table3';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { task } from 'hardhat/config';

task(TASK_INSPECT_STORAGE_LAYOUT)
  .addPositionalParam('contract', 'Contract whose storage layout to inspect')
  .setAction(async (args, hre) => {
    await hre.run(TASK_COMPILE);

    const { storage, types } = await getStorageLayout(hre, args.contract);

    const table = new Table({
      style: { head: [], border: [], 'padding-left': 2, 'padding-right': 2 },
      chars: {
        mid: '·',
        'top-mid': '|',
        'left-mid': ' ·',
        'mid-mid': '|',
        'right-mid': '·',
        left: ' |',
        'top-left': ' ·',
        'top-right': '·',
        'bottom-left': ' ·',
        'bottom-right': '·',
        middle: '·',
        top: '-',
        bottom: '-',
        'bottom-mid': '|',
      },
    });

    table.push([
      { content: 'slot' },
      { content: 'offset' },
      { content: 'type' },
      { content: 'name' },
      { content: 'visualization (right to left)' },
    ]);

    const slots = collateSlotEntries(types, storage);

    for (const slot of slots) {
      let offset = 0;

      for (const entry of slot.entries) {
        const type = types[entry.type];
        const visualization = visualizeSlot(
          offset,
          entry.sizeFilled!,
          slot.sizeFilled,
        );

        table.push([
          { content: slot.id },
          { content: offset },
          { content: type.label },
          { content: entry.label },
          { content: visualization },
        ]);

        offset += entry.sizeFilled!;
      }
    }

    console.log(table.toString());
  });
