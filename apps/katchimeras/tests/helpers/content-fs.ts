import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { contentPath, readVerificationSource } = require('@incubator/art-pipeline/context');
const gameRoot = path.resolve(import.meta.dirname, '../..');
function physical(filename: fs.PathLike): fs.PathLike {
  const value = filename instanceof URL ? fileURLToPath(filename.toString()) : filename;
  return typeof value === 'string' ? contentPath(gameRoot, value) : value;
}
// Source assertions cover both the game binding and its extracted implementation.
// Binary art assertions still inspect the real bytes in the selected content pack.
export const readFileSync: typeof fs.readFileSync = ((filename: fs.PathOrFileDescriptor, options: unknown) => {
  if (typeof filename === 'number' || Buffer.isBuffer(filename)) return fs.readFileSync(filename, options as never);
  return readVerificationSource(physical(filename), options);
}) as typeof fs.readFileSync;
export const existsSync: typeof fs.existsSync = (filename) => fs.existsSync(physical(filename));
export const readdirSync: typeof fs.readdirSync = ((filename: fs.PathLike, options: unknown) => fs.readdirSync(physical(filename), options as never)) as typeof fs.readdirSync;
export const statSync: typeof fs.statSync = ((filename: fs.PathLike, options: unknown) => fs.statSync(physical(filename), options as never)) as typeof fs.statSync;
export default { ...fs, readFileSync, existsSync, statSync, readdirSync };
