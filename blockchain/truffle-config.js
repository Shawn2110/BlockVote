// Loaded only when actually deploying — keeps local-only flows from needing the package.
let HDWalletProvider;
try { HDWalletProvider = require('@truffle/hdwallet-provider'); } catch (_) { /* optional */ }

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const PRODUCTION_RPC = process.env.PRODUCTION_RPC_URL; // e.g. https://blockvote-chain-production.up.railway.app
const MNEMONIC       = process.env.MNEMONIC;           // 12-word phrase that controls the deployer account

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },

    // Use: truffle migrate --network production --reset
    // Requires PRODUCTION_RPC_URL and MNEMONIC in .env, plus @truffle/hdwallet-provider installed.
    production: {
      provider: () => {
        if (!HDWalletProvider) throw new Error('Install @truffle/hdwallet-provider: npm i -D @truffle/hdwallet-provider');
        if (!MNEMONIC || !PRODUCTION_RPC) throw new Error('Set MNEMONIC and PRODUCTION_RPC_URL in .env');
        return new HDWalletProvider(MNEMONIC, PRODUCTION_RPC);
      },
      network_id: 1337,
      gas: 6000000,
      gasPrice: 20000000000
    }
  }
};
