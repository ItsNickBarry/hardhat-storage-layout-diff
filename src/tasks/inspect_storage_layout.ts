import { getStorageLayout, visualizeSlot } from '../lib/storage_layout_diff';
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

    type Entry = {
      type: string;
      label: string;
      sizeFilled?: number;
    };

    type Slot = {
      id: bigint;
      sizeReserved: number;
      sizeFilled: number;
      entries: Entry[];
    };

    const slots: Slot[] = [
      { id: 0n, sizeReserved: 0, sizeFilled: 0, entries: [] },
    ];

    const proc = (slots: Slot[], entries: Entry[], index = 0) => {
      let slot = slots[slots.length - 1];

      const entry = entries[index];
      if (!entry) return;
      const type = types[entry.type];

      // create a new slot if current entry requires it

      if (
        slot.entries.length !== 0 &&
        32 - slot.sizeReserved < Number(type.numberOfBytes)
      ) {
        slot = {
          id: slot.id + 1n,
          sizeReserved: 0,
          sizeFilled: 0,
          entries: [],
        };
        slots.push(slot);
      }

      if (type.encoding === 'mapping') {
        // a mapping slot reserves 32 bytes, but writes no data
        const sizeReserved = 32;
        const sizeFilled = 0;

        slot.sizeReserved += sizeReserved;
        slot.sizeFilled += sizeFilled;

        slot.entries.push({
          type: entry.type,
          label: entry.label,
          sizeFilled,
        });
      } else if (type.encoding === 'dynamic_array') {
        // a dynamic array slot stores the array length using 32 bytes
        const sizeReserved = 32;
        const sizeFilled = 32;

        slot.sizeReserved += sizeReserved;
        slot.sizeFilled += sizeFilled;

        slot.entries.push({
          type: entry.type,
          label: entry.label,
          sizeFilled,
        });
      } else {
        // type encoding is 'inplace', and might not fill its slot
        if (type.members) {
          // type is a struct

          const members: Entry[] = type.members.map((m) => ({
            type: m.type,
            label: `${entry.label}.${m.label}`,
          }));

          proc(slots, members);

          // struct reserves the entirety of its final slot
          // retrieve the slot from the array in case a new one was added during the recursive call
          slots[slots.length - 1].sizeReserved = 32;
        } else if (type.base) {
          // type is a fixed array

          const [, count] = type.label.match(/.+\[(\d+)\]$/)!;

          const members: Entry[] = [];

          for (let i = 0; i < Number(count); i++) {
            members.push({ type: type.base, label: `${entry.label}[${i}]` });
          }

          proc(slots, members);

          // array reserves the entirety of its final slot
          // retrieve the slot from the array in case a new one was added during the recursive call
          slots[slots.length - 1].sizeReserved = 32;
        } else {
          // type is a value type
          const sizeReserved = Number(type.numberOfBytes);
          const sizeFilled = sizeReserved;

          slot.sizeReserved += sizeReserved;
          slot.sizeFilled += sizeFilled;

          slot.entries.push({
            type: entry.type,
            label: entry.label,
            sizeFilled,
          });
        }
      }

      proc(slots, entries, index + 1);
    };

    proc(slots, storage);

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
