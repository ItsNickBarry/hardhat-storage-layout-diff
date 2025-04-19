import {
  getStorageLayout,
  collateStorageLayout,
  mergeCollatedSlots,
  visualizeSlot,
} from '../lib/storage_layout_diff';
import { TASK_DIFF_STORAGE_LAYOUT } from '../task_names';
import chalk from 'chalk';
import Table from 'cli-table3';
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

    const merge = mergeCollatedSlots(slotsA, slotsB);

    console.log(merge);
    console.log(merge.map((m) => m.entries));

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
      // { content: 'visualization (right to left)' },
    ]);

    for (const slot of merge) {
      for (const entry of slot.entries) {
        let offset;
        let name;
        let type;

        if (entry.offsetA === entry.offsetB) {
          offset = entry.offsetA;
        } else {
          offset = `${chalk.red(entry.offsetA)} => ${chalk.green(entry.offsetB)}`;
        }

        if (entry.nameA === entry.nameB) {
          name = entry.nameA;
        } else {
          name = `${chalk.red(entry.nameA)} => ${chalk.green(entry.nameB)}`;
        }

        if (entry.typeA.label === entry.typeB.label) {
          type = entry.typeA.label;
        } else if (entry.typeA.numberOfBytes === entry.typeB.numberOfBytes) {
          type = `${chalk.red(entry.typeA.label)} => ${chalk.green(entry.typeB.label)}`;
        } else {
          type = `${chalk.red(entry.typeA.label)} => ${chalk.green(entry.typeB.label)}`;
        }

        const visualizationA = visualizeSlot(
          entry.offsetA,
          entry.sizeA,
          slot.sizeFilledA,
        );
        const visualizationB = visualizeSlot(
          entry.offsetB,
          entry.sizeB,
          slot.sizeFilledB,
        );

        const visualization = visualizationA
          .split('')
          .map((charA, i) => {
            const charB = visualizationB.charAt(i);

            if (charA === charB) {
              return charA === '▰' ? chalk.magenta(charA) : charA;
            } else if (charA === '▰' || charB === '▰') {
              // one char is filled, and it doesn't matter whether the other is a placeholder or empty
              return chalk.red('▰');
            } else {
              // chars differ and neither is filled, so one is a placeholder and one is empty
              return '▱';
            }
          })
          .join('');

        table.push([
          { content: slot.id },
          { content: offset },
          { content: type },
          { content: name },
          { content: visualization },
        ]);
      }
    }

    console.log(table.toString());
  });
