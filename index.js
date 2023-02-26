const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const simpleGit = require('simple-git');
const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');

const {
  TASK_COMPILE,
} = require('hardhat/builtin-tasks/task-names');

const loadStorageLayout = async function (fullName, ref) {
  const repository = simpleGit();
  await repository.init();
  const { latest } = await repository.log();

  // TODO: error if ref === 'HEAD'

  await repository.checkout(ref || latest.hash);
  await hre.run(TASK_COMPILE);

  const info = await hre.artifacts.getBuildInfo(fullName);
  const { sourceName, contractName } = parseFullyQualifiedName(fullName);

  await repository.checkout('-');

  return parseStorageLayout(info.output.contracts[sourceName][contractName].storageLayout)
}

const parseStorageLayout = function ({ storage, types }) {
  return storage.reduce(function (acc, { label, offset, slot, type}) {
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

const mergeStorageLayouts = function (storageA, storageB) {
  const equal = function (a, b) {
    return a.label == b.label && a.type?.replace(/\[\d*\]/, '[]') == b.type?.replace(/\[\d*\]/, '[]');
  };

  let bytesIndex = 0;
  let indexA = 0;
  let indexB = 0;

  // ensure even byte lengths

  const tail = {
    bytesEnd: Math.max(
      storageA[storageA.length - 1].bytesEnd,
      storageB[storageB.length - 1].bytesEnd
    )
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

task(TASK_COMPILE, async function (args, hre, runSuper) {
  for (let compiler of hre.config.solidity.compilers) {
    compiler.settings.outputSelection['*']['*'].push('storageLayout');
  }

  await runSuper();
});

task(
  'export-storage-layout'
).setAction(async function () {
  // TODO: define as Hardhat config
  const config = { path: './storage_layout', only: [], except: [], spacing: 2 };

  const outputDirectory = path.resolve(hre.config.paths.root, config.path);

  if (!outputDirectory.startsWith(hre.config.paths.root)) {
    throw new HardhatPluginError('resolved path must be inside of project directory');
  }

  if (outputDirectory === hre.config.paths.root) {
    throw new HardhatPluginError('resolved path must not be root directory');
  }

  if (config.clear && fs.existsSync(outputDirectory)) {
    fs.rmdirSync(outputDirectory, { recursive: true });
  }

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  for (let fullName of await hre.artifacts.getAllFullyQualifiedNames()) {
    if (config.only.length && !config.only.some(m => fullName.match(m))) continue;
    if (config.except.length && config.except.some(m => fullName.match(m))) continue;

    const info = await hre.artifacts.getBuildInfo(fullName);
    const { sourceName, contractName } = parseFullyQualifiedName(fullName);
    const { storage, types } = info.output.contracts[sourceName][contractName].storageLayout;

    if (!storage.length) continue;

    const destination = path.resolve(
      outputDirectory,
      config.flat ? '' : '',
      fullName
    ) + '.json';

    if (!fs.existsSync(path.dirname(destination))) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
    }

    fs.writeFileSync(destination, `${ JSON.stringify({ storage, types }, null, config.spacing) }\n`, { flag: 'w' });
  }
})

task(
  'storage-layout-check'
).addParam(
  'source', 'Path to storage layout JSON'
).addParam(
  'b', 'Contract to check against storage layout'
).addOptionalParam(
  'bRef', 'Git reference where contract B is defined'
).setAction(async function ({ source, b, bRef }) {
  const layout = parseStorageLayout(JSON.parse(fs.readFileSync(source)));
  const storageB = await loadStorageLayout(b, bRef);
  const data = mergeStorageLayouts(layout, storageB);

  ejs.renderFile(path.resolve(__dirname, 'template.html.ejs'), { data, titleA: source, titleB: b }, {}, function (err, result) {
    if (err) {
      console.log(err);
    } else {
      fs.writeFileSync('./out.html', result);
    }
  });
});

task(
  'storage-layout-compare'
).addParam(
  'a', 'First contract to diff'
).addParam(
  'b', 'Second contract to diff'
).addOptionalParam(
  'aRef', 'Git reference where contract A is defined'
).addOptionalParam(
  'bRef', 'Git reference where contract B is defined'
).setAction(async function ({ a, b, aRef, bRef }, hre) {
  const storageA = await loadStorageLayout(a, aRef);
  const storageB = await loadStorageLayout(b, bRef);
  const data = mergeStorageLayouts(storageA, storageB);

  ejs.renderFile(path.resolve(__dirname, 'template.html.ejs'), { data, titleA: a, titleB: b }, {}, function (err, result) {
    if (err) {
      console.log(err);
    } else {
      fs.writeFileSync('./out.html', result);
    }
  });
});
