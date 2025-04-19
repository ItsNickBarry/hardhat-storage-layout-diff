import pkg from '../../package.json';
import chalk from 'chalk';
import Table from 'cli-table3';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { HardhatPluginError } from 'hardhat/plugins';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import assert from 'node:assert';
import simpleGit from 'simple-git';

export type StorageElement = {
  contract: string;
  label: string;
  offset: number;
  slot: string;
  type: string;
};

export type StorageType = {
  encoding: 'inplace' | 'mapping' | 'dynamic_array';
  label: string;
  numberOfBytes: string;
  // `base` is present on array types and represents the type of each array element
  base?: string;
  // `members` is present on struct types and is a list of component types
  members?: StorageElement[];
};

export type StorageTypes = {
  [name: string]: StorageType;
};

export type StorageLayout = {
  storage: StorageElement[];
  types: StorageTypes;
};

export type ParsedStorageElement = Partial<
  StorageElement & { size: number }
> & {
  bytesStart: number;
  bytesEnd: number;
};

type CollatedSlotEntry = {
  name: string;
  size: number;
  offset: number;
  type: StorageType;
};

type CollatedSlot = {
  id: bigint;
  sizeReserved: number;
  sizeFilled: number;
  entries: CollatedSlotEntry[];
};

type MergedCollatedSlotEntry = {
  nameA: string;
  nameB: string;
  sizeA: number;
  sizeB: number;
  offsetA: number;
  offsetB: number;
  typeA: StorageType;
  typeB: StorageType;
};

type MergedCollatedSlot = {
  id: bigint;
  sizeReservedA: number;
  sizeReservedB: number;
  sizeFilledA: number;
  sizeFilledB: number;
  entries: MergedCollatedSlotEntry[];
};

export const visualizeSlot = (
  offset: number,
  size: number,
  slotFill: number,
) => {
  const chars = {
    filled: '▰',
    placeholder: '▱',
    empty: ' ',
  };

  return (
    chars.empty.repeat(32 - slotFill) +
    chars.placeholder.repeat(slotFill - size - offset) +
    chars.filled.repeat(size) +
    chars.placeholder.repeat(offset)
  );
};

export const getStorageLayout = async (
  hre: HardhatRuntimeEnvironment,
  fullName: string,
): Promise<StorageLayout> => {
  const info = await hre.artifacts.getBuildInfo(fullName);

  if (!info) {
    throw new HardhatPluginError(pkg.name, `contract not found at ref`);
  }

  const { sourceName, contractName } = parseFullyQualifiedName(fullName);

  return (info.output.contracts[sourceName][contractName] as any).storageLayout;
};

export const loadStorageLayout = async function (
  hre: HardhatRuntimeEnvironment,
  fullName: string,
  ref: string,
) {
  const repository = simpleGit();
  await repository.init();
  const { latest } = await repository.log();

  // TODO: error if ref === 'HEAD'

  if (!latest) {
    throw new HardhatPluginError(pkg.name, 'ref error');
  }

  await repository.checkout(ref || latest.hash);

  try {
    await hre.run(TASK_COMPILE);
  } catch (error) {
    throw error;
  } finally {
    await repository.checkout('-');
    // TODO: create a temp hre or set hre.config.paths.artifacts to avoid overwriting current compilation
    await hre.run(TASK_COMPILE);
  }

  const storageLayout = await getStorageLayout(hre, fullName);

  return collateStorageLayout(storageLayout);
};

export const collateStorageLayout = (
  storageLayout: StorageLayout,
): CollatedSlot[] => {
  const { types, storage } = storageLayout;

  type Element = Pick<StorageElement, 'type' | 'label'>;

  const reducer = (slots: CollatedSlot[], element: Element) => {
    const type = types[element.type];

    let slot = slots[slots.length - 1];

    if (!slot) {
      // create a new slot if none exist
      // TODO: custom layout feature allows first slot to be > 0
      slot = { id: 0n, sizeReserved: 0, sizeFilled: 0, entries: [] };
      slots.push(slot);
    } else if (Number(type.numberOfBytes) + slot.sizeReserved > 32) {
      // create a new slot if current element doesn't fit
      slot = { id: slot.id + 1n, sizeReserved: 0, sizeFilled: 0, entries: [] };
      slots.push(slot);
    }

    if (type.encoding === 'inplace' && (type.members || type.base)) {
      // type is either a struct or a fixed array
      const members: Element[] = [];

      if (type.members) {
        // type is a struct
        for (let i = 0; i < type.members.length; i++) {
          members.push({
            type: type.members[i].type,
            label: `${element.label}.${type.members[i].label}`,
          });
        }
      } else if (type.base) {
        // type is a fixed array
        const [, count] = type.label.match(/.+\[(\d+)\]$/)!;

        for (let i = 0; i < Number(count); i++) {
          members.push({ type: type.base, label: `${element.label}[${i}]` });
        }
      }

      // process the members recursively, operating on the same `slots` array
      members.reduce(reducer, slots);

      // structs and fixed arrays reserve the entirety of their final slots
      // retrieve the slot from the array in case a new one was added during the recursive call
      slots[slots.length - 1].sizeReserved = 32;
    } else {
      // type is a value type, a dynamic array, or a mapping

      // a dynamic array slot stores the array length using 32 bytes
      // a mapping slot reserves 32 bytes, but contains no data

      const sizeReserved = Number(type.numberOfBytes);
      const sizeFilled = type.encoding === 'mapping' ? 0 : sizeReserved;

      slot.entries.push({
        name: element.label,
        size: sizeFilled,
        offset: slot.sizeReserved,
        type,
      });

      slot.sizeReserved += sizeReserved;
      slot.sizeFilled += sizeFilled;
    }

    return slots;
  };

  return storage.reduce(reducer, []);
};

export const mergeCollatedSlots = (
  slotsA: CollatedSlot[],
  slotsB: CollatedSlot[],
): MergedCollatedSlot[] => {
  // TODO: support starting from slot > 0
  // TODO: must use bigint or string for custom layouts

  // TODO: support different lengths
  assert.equal(slotsA.length, slotsB.length);

  const output: MergedCollatedSlot[] = [];

  for (let i = 0; i < slotsA.length; i++) {
    const slotA = slotsA[i];
    const slotB = slotsB[i];

    assert.equal(slotA.id, slotB.id);

    const mergedEntries: MergedCollatedSlotEntry[] = [];

    let entryIndexA = 0;
    let entryIndexB = 0;
    let entryA;
    let entryB;

    while (
      (entryA = slotA.entries[entryIndexA]) &&
      (entryB = slotB.entries[entryIndexB])
    ) {
      const mergedEntry: MergedCollatedSlotEntry = {
        nameA: entryA.name,
        nameB: entryB.name,
        sizeA: entryA.size,
        sizeB: entryB.size,
        offsetA: entryA.offset,
        offsetB: entryB.offset,
        typeA: entryA.type,
        typeB: entryB.type,
      };

      mergedEntries.push(mergedEntry);

      const endA = entryA.size + entryA.offset;
      const endB = entryB.size + entryB.offset;

      if (endA <= endB) entryIndexA++;
      if (endB <= endA) entryIndexB++;
    }

    // TODO: add tail entries

    output.push({
      id: slotA.id,
      sizeReservedA: slotA.sizeReserved,
      sizeReservedB: slotB.sizeReserved,
      sizeFilledA: slotA.sizeFilled,
      sizeFilledB: slotB.sizeFilled,
      entries: mergedEntries,
    });
  }

  return output;
};

export const printCollatedSlots = (slots: CollatedSlot[]) => {
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

  for (const slot of slots) {
    for (const entry of slot.entries) {
      const visualization = visualizeSlot(
        entry.offset,
        entry.size,
        slot.sizeFilled,
      );

      table.push([
        { content: slot.id },
        { content: entry.offset },
        { content: entry.type.label },
        { content: entry.name },
        { content: visualization },
      ]);
    }
  }

  console.log(table.toString());
};

export const printMergedCollatedSlots = (slots: MergedCollatedSlot[]) => {
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

  for (const slot of slots) {
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
};
