// load environment variables
require('dotenv').config();

import System from './System';

const system = new System();

system.start()
.then((isStarted) => {
    if(isStarted) {
        console.log('System: started successfully');
    }
    else {
        console.log('System: start failed');
        console.log('System: restarting...');
    }
})
.catch(err => {
    console.log('System error: ' + err.message);
    console.log('System: restarting...');

    // TODO: restart system on failure
});


/**
 * Closed on error/generic
 */
 process.on('SIGTERM', async () => {
    console.info('SIGTERM signal received.');

    console.log('System error: stopping...');
    await system.stop();
    console.log('System: stopped');

    process.exit();
});

/**
 * Closed on file changes (nodemon)
 */
process.on('SIGUSR2', async () => {
    console.info('SIGUSR2 signal received.');

    await system.stop();
    console.log('System: stopped');

    process.exit();
});

/**
 * Closed with keypress ctrl+c
 */
process.on('SIGINT', async () => {
    console.info('SIGINT signal received.');

    console.log('System: stopping...');
    await system.stop();
    console.log('System: stopped');
    
    process.exit();
});