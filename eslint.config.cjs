const {defineConfig} = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([
  {ignores:['node_modules/**','dist/**','.tmp/**','apps/**','art/**','art-source/**','tooling/**','packages/art-service/**']},
  expo,
]);
