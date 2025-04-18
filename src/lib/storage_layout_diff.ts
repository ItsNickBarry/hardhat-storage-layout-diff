import pkg from '../../package.json';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { HardhatPluginError } from 'hardhat/plugins';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import simpleGit from 'simple-git';

export type StorageType = {
  encoding: 'inplace' | 'mapping' | 'dynamic_array';
  label: string;
  numberOfBytes: string;
  base?: string;
  members?: StorageElement[];
};

export type StorageElement = {
  contract: string;
  label: string;
  offset: number;
  slot: string;
  type: string;
};

export type StorageLayoutTypes = {
  [name: string]: StorageType;
};

export type StorageLayout = {
  storage: StorageElement[];
  types: StorageLayoutTypes;
};

export type ParsedStorageElement = Partial<
  StorageElement & { size: number }
> & {
  bytesStart: number;
  bytesEnd: number;
};

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

export const visualizeSlot = (
  offset: number,
  size: number,
  slotFill: number,
) => {
  const filled = '▰';
  const empty = '▱';

  return (
    ' '.repeat(32 - slotFill) +
    empty.repeat(slotFill - size - offset) +
    filled.repeat(size) +
    empty.repeat(offset)
  );
};

export const getStorageLayout = async (
  hre: HardhatRuntimeEnvironment,
  fullName: string,
) => {
  const info = await hre.artifacts.getBuildInfo(fullName);

  if (!info) {
    throw new HardhatPluginError(pkg.name, `contract not found at ref`);
  }

  const { sourceName, contractName } = parseFullyQualifiedName(fullName);

  return (info.output.contracts[sourceName][contractName] as any)
    .storageLayout as StorageLayout;
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
  }

  const storageLayout = await getStorageLayout(hre, fullName);

  return parseStorageLayout(storageLayout);
};

export const parseStorageLayout = function (storageLayout: StorageLayout) {
  const { storage, types } = storageLayout;

  return storage.reduce(function (acc, { label, offset, slot, type }) {
    const size = parseInt(types[type].numberOfBytes);
    const bytesStart = parseInt(slot) * 32 + offset;
    const bytesEnd = bytesStart + size - 1;

    if (acc.length > 0 && bytesStart > acc[acc.length - 1].bytesEnd + 1) {
      acc.push({
        label: '',
        type: '',
        bytesStart: acc[acc.length - 1].bytesEnd + 1,
        bytesEnd: bytesStart - 1,
      });
    }

    acc.push({
      label,
      type: types[type].label,
      slot,
      offset,
      size,
      bytesStart,
      bytesEnd,
    });

    return acc;
  }, [] as ParsedStorageElement[]);
};

export const mergeStorageLayouts = function (
  storageA: ParsedStorageElement[],
  storageB: ParsedStorageElement[],
) {
  const equal = function (a: ParsedStorageElement, b: ParsedStorageElement) {
    return (
      a.label == b.label &&
      a.type?.replace(/\[\d*\]/, '[]') == b.type?.replace(/\[\d*\]/, '[]')
    );
  };

  let bytesIndex = 0;
  let indexA = 0;
  let indexB = 0;

  // ensure even byte lengths

  storageA.push({
    bytesStart: storageA[storageA.length - 1].bytesEnd + 1,
    bytesEnd: Math.max(
      storageA[storageA.length - 1].bytesEnd,
      storageB[storageB.length - 1].bytesEnd,
    ),
  });

  storageB.push({
    bytesStart: storageB[storageB.length - 1].bytesEnd + 1,
    bytesEnd: Math.max(
      storageA[storageA.length - 1].bytesEnd,
      storageB[storageB.length - 1].bytesEnd,
    ),
  });

  const output = [];

  while (storageA[indexA] && storageB[indexB]) {
    const elementA = storageA[indexA];
    const elementB = storageB[indexB];

    const bytesEndA = elementA.bytesEnd;
    const bytesEndB = elementB.bytesEnd;

    const bytesStart = bytesIndex;
    const bytesEnd = Math.min(bytesEndA, bytesEndB);

    output.push({
      bytesStart,
      bytesEnd,
      elementA,
      elementB,
      changed: !equal(elementA, elementB),
    });

    if (bytesEndA >= bytesEndB) {
      indexB++;
    }

    if (bytesEndB >= bytesEndA) {
      indexA++;
    }

    bytesIndex = bytesEnd + 1;
  }

  return output;
};

export const collateSlotEntries = (
  types: StorageLayoutTypes,
  storage: Entry[],
) => {
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

  return slots;
};
