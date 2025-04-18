import pkg from '../package.json';
import {
  TASK_EXPORT_STORAGE_LAYOUT,
  TASK_INSPECT_STORAGE_LAYOUT,
  TASK_STORAGE_LAYOUT_CHECK,
  TASK_STORAGE_LAYOUT_COMPARE,
} from './task_names';
import './type_extensions';
import type { StorageLayoutDiffConfig } from './types';
import Table from 'cli-table3';
import ejs from 'ejs';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { extendConfig } from 'hardhat/config';
import { task } from 'hardhat/config';
import { HardhatPluginError } from 'hardhat/plugins';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import fs from 'node:fs';
import path from 'node:path';
import simpleGit from 'simple-git';

// TODO: types may be incomplete
type StorageElement = {
  contract: string;
  label: string;
  offset: number;
  slot: string;
  type: string;
};
type StorageLayout = {
  storage: StorageElement[];
  types: {
    [name: string]: { encoding: string; label: string; numberOfBytes: string };
  };
};

type ParsedStorageElement = Partial<StorageElement & { size: number }> & {
  bytesStart: number;
  bytesEnd: number;
};

const DEFAULT_CONFIG: StorageLayoutDiffConfig = {
  path: './storage_layout',
  clear: false,
  flat: false,
  only: [],
  except: [],
  spacing: 2,
};

extendConfig(function (config, userConfig) {
  config.storageLayoutDiff = Object.assign(
    {},
    DEFAULT_CONFIG,
    userConfig.storageLayoutDiff,
  );

  for (const compiler of config.solidity.compilers) {
    const outputSelection = compiler.settings.outputSelection['*']['*'];

    if (!outputSelection.includes('storageLayout')) {
      outputSelection.push('storageLayout');
    }
  }
});

const visualizeSlot = (offset: number, size: number, slotFill: number) => {
  const filled = '▰';
  const empty = '▱';

  return (
    ' '.repeat(32 - slotFill) +
    empty.repeat(slotFill - size - offset) +
    filled.repeat(size) +
    empty.repeat(offset)
  );
};

const getStorageLayout = async (
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

const loadStorageLayout = async function (
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

const parseStorageLayout = function (storageLayout: StorageLayout) {
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

const mergeStorageLayouts = function (
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

task(TASK_EXPORT_STORAGE_LAYOUT).setAction(async function (args, hre) {
  const config = hre.config.storageLayoutDiff;

  const outputDirectory = path.resolve(hre.config.paths.root, config.path);

  if (!outputDirectory.startsWith(hre.config.paths.root)) {
    throw new HardhatPluginError(
      pkg.name,
      'resolved path must be inside of project directory',
    );
  }

  if (outputDirectory === hre.config.paths.root) {
    throw new HardhatPluginError(
      pkg.name,
      'resolved path must not be root directory',
    );
  }

  if (config.clear && fs.existsSync(outputDirectory)) {
    fs.rmdirSync(outputDirectory, { recursive: true });
  }

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  for (let fullName of await hre.artifacts.getAllFullyQualifiedNames()) {
    if (config.only.length && !config.only.some((m) => fullName.match(m)))
      continue;
    if (config.except.length && config.except.some((m) => fullName.match(m)))
      continue;

    const storageLayout = await getStorageLayout(hre, fullName);
    const { storage, types } = storageLayout;

    if (!storage.length) continue;

    const destination =
      path.resolve(outputDirectory, config.flat ? '' : '', fullName) + '.json';

    if (!fs.existsSync(path.dirname(destination))) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
    }

    fs.writeFileSync(
      destination,
      `${JSON.stringify({ storage, types }, null, config.spacing)}\n`,
    );
  }
});

task(TASK_STORAGE_LAYOUT_CHECK)
  .addParam('source', 'Path to storage layout JSON')
  .addParam('b', 'Contract to check against storage layout')
  .addOptionalParam('bRef', 'Git reference where contract B is defined')
  .setAction(async function ({ source, b, bRef }, hre) {
    const layout = parseStorageLayout(
      JSON.parse(fs.readFileSync(source, 'utf-8')),
    );
    const storageB = await loadStorageLayout(hre, b, bRef);
    const data = mergeStorageLayouts(layout, storageB);

    const contents = await ejs.renderFile(
      path.resolve(__dirname, 'template.html.ejs'),
      { data, titleA: source, titleB: b },
    );

    await fs.promises.writeFile('./out.html', contents);
  });

task(TASK_STORAGE_LAYOUT_COMPARE)
  .addParam('a', 'First contract to diff')
  .addParam('b', 'Second contract to diff')
  .addOptionalParam('aRef', 'Git reference where contract A is defined')
  .addOptionalParam('bRef', 'Git reference where contract B is defined')
  .setAction(async function ({ a, b, aRef, bRef }, hre) {
    const storageA = await loadStorageLayout(hre, a, aRef);
    const storageB = await loadStorageLayout(hre, b, bRef);
    const data = mergeStorageLayouts(storageA, storageB);

    const contents = await ejs.renderFile(
      path.resolve(__dirname, 'template.html.ejs'),
      { data, titleA: a, titleB: b },
    );

    await fs.promises.writeFile('./out.html', contents);
  });

task(TASK_INSPECT_STORAGE_LAYOUT)
  .addPositionalParam('contract', 'Contract whose storage layout to inspect')
  .setAction(async (args, hre) => {
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

    for (let i = 0; i < storage.length; i++) {
      const entry = storage[i];
      const size = parseInt(types[entry.type].numberOfBytes);

      let slotFill = 0;

      for (let j = i; j < storage.length; j++) {
        const nextEntry = storage[j];

        if (nextEntry.slot !== entry.slot) break;

        slotFill =
          nextEntry.offset + parseInt(types[nextEntry.type].numberOfBytes);
      }

      table.push([
        { content: entry.slot },
        { content: entry.offset },
        { content: types[entry.type].label },
        { content: entry.label },
        {
          content: visualizeSlot(entry.offset, size, slotFill),
        },
      ]);
    }

    console.log(table.toString());
  });
