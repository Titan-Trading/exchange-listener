// load environment variables
require('dotenv').config();

import System from './System';

const system = new System();
system.start();

/**
 * Closed on error/generic
 */
 process.on('SIGTERM', async () => {
    console.info('SIGTERM signal received.');
    await system.stop();
    process.exit(0);
});

/**
 * Closed with keypress ctrl+c
 */
process.on('SIGINT', async () => {
    console.info('SIGINT signal received.');
    await system.stop();
    process.exit(0);
});