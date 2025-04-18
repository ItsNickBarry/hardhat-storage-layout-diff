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

export type StorageLayout = {
  storage: StorageElement[];
  types: {
    [name: string]: StorageType;
  };
};

export type ParsedStorageElement = Partial<
  StorageElement & { size: number }
> & {
  bytesStart: number;
  bytesEnd: number;
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
