import semver from 'semver';
import config from './package.json' assert { type: 'json' };
const { engines } = config;

const version = engines.node;
if (!semver.satisfies(process.version, version)) {
  throw new Error(
    `WRONG NODE VERSION DETECTED: The current node version ${process.version} does not satisfy the required version ${version} .`,
  );
}
