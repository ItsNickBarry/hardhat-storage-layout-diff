import pkg from '../package.json';
import {
  TASK_EXPORT_STORAGE_LAYOUT,
  TASK_STORAGE_LAYOUT_CHECK,
  TASK_STORAGE_LAYOUT_COMPARE,
} from './task_names';
import './type_extensions';
import type { StorageLayoutDiffConfig } from './types';
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

type StorageElement = any;
type StorageLayout = { storage: StorageElement[]; types: any };

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
  await hre.run(TASK_COMPILE);

  const info = await hre.artifacts.getBuildInfo(fullName);

  if (!info) {
    throw new HardhatPluginError(pkg.name, `contract not found at ref`);
  }

  const { sourceName, contractName } = parseFullyQualifiedName(fullName);

  await repository.checkout('-');

  const compilerOutputContract = info.output.contracts[sourceName][
    contractName
  ] as unknown as { storageLayout: StorageLayout };

  return parseStorageLayout(compilerOutputContract.storageLayout);
};

const parseStorageLayout = function (storageLayout: StorageLayout) {
  const { storage, types } = storageLayout;

  return storage.reduce(function (acc, { label, offset, slot, type }) {
    const size = parseInt(types[type].numberOfBytes);
    const bytesStart = parseInt(slot) * 32 + parseInt(offset);
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
      slot: parseInt(slot),
      offset,
      size,
      bytesStart,
      bytesEnd,
    });

    return acc;
  }, []);
};

const mergeStorageLayouts = function (storageA: Storage, storageB: Storage) {
  const equal = function (a: StorageElement, b: StorageElement) {
    return (
      a.label == b.label &&
      a.type?.replace(/\[\d*\]/, '[]') == b.type?.replace(/\[\d*\]/, '[]')
    );
  };

  let bytesIndex = 0;
  let indexA = 0;
  let indexB = 0;

  // ensure even byte lengths

  const tail = {
    bytesEnd: Math.max(
      storageA[storageA.length - 1].bytesEnd,
      storageB[storageB.length - 1].bytesEnd,
    ),
  };

  storageA.push(tail);
  storageB.push(tail);

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

    const info = await hre.artifacts.getBuildInfo(fullName);
    const { sourceName, contractName } = parseFullyQualifiedName(fullName);

    const compilerOutputContract = info!.output.contracts[sourceName][
      contractName
    ] as unknown as { storageLayout: StorageLayout };
    const { storage, types } = compilerOutputContract.storageLayout;

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

    ejs.renderFile(
      path.resolve(__dirname, 'template.html.ejs'),
      { data, titleA: source, titleB: b },
      {},
      function (err, result) {
        if (err) {
          console.log(err);
        } else {
          fs.writeFileSync('./out.html', result);
        }
      },
    );
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

    ejs.renderFile(
      path.resolve(__dirname, 'template.html.ejs'),
      { data, titleA: a, titleB: b },
      {},
      function (err, result) {
        if (err) {
          console.log(err);
        } else {
          fs.writeFileSync('./out.html', result);
        }
      },
    );
  });
