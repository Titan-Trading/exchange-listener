// load environment variables
require('dotenv').config();

import System from './System';

const system = new System();
system.start();

/**
 * Closed on error/generic
 */
 process.on('SIGTERM', () => {
    console.info('SIGTERM signal received.');
    system.stop();
    process.exit(0);
});

/**
 * Closed with keypress ctrl+c
 */
process.on('SIGINT', () => {
    console.info('SIGINT signal received.');
    system.stop();
    process.exit(0);
});


/*import axios from 'axios';

// create a write API, expecting point timestamps in nanoseconds (can be also 's', 'ms', 'us')
const writeApi = new InfluxDB({url: process.env.INFLUX_URL, token: process.env.INFLUX_TOKEN}).getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET, 'ns')
// setup default tags for all writes through this API
// writeApi.useDefaultTags({location: hostname()})

axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1000')
    .then((res) => {
        let points = [];

        res.data.map((row) => {
            const point = new Point('candlesticks')
                .tag('exchange', 'binance')
                .tag('symbol', 'BTCUSDT')
                .tag('interval', '1m')
                .floatField('open', parseFloat(row[1]))
                .floatField('high', parseFloat(row[2]))
                .floatField('low', parseFloat(row[3]))
                .floatField('close', parseFloat(row[4]))
                .floatField('volume', parseFloat(row[5]))
                .timestamp(new Date(row[0]));

            points.push(point);
        });

        writeApi.writePoints(points);
 
        writeApi
            .close()
            .then(() => {
                console.log('FINISHED...');
            })
            .catch(e => {
                console.error(e);
                if (e instanceof HttpError && e.statusCode === 401) {
                    console.log('Run ./onboarding.js to setup a new InfluxDB database.');
                }
                console.log('\nFinished ERROR');
            });
    });

// const point = new Point('candlesticks')
//     .tag('exchange', 'binance')
//     .tag('symbol', 'ETHUSDT')
//     .floatField('open', parseFloat(10.00))
//     .floatField('high', parseFloat(10.00))
//     .floatField('low', parseFloat(3.00))
//     .floatField('close', parseFloat(10.00))
//     .floatField('volume', parseFloat(3.00))
//     .timestamp(new Date(1638341807000));

// writeApi.writePoints([point]);

// console.log(` ${point.toLineProtocol(writeApi)} `);

// WriteApi always buffer data into batches to optimize data transfer to InfluxDB server and retries
// writing upon server/network failure. writeApi.flush() can be called to flush the buffered data,
// close() also flushes the remaining buffered data and then cancels pending retries.
// writeApi
//   .close()
//   .then(() => {
//     console.log('FINISHED ... now try ./query.ts')
//   })
//   .catch(e => {
//     console.error(e)
//     if (e instanceof HttpError && e.statusCode === 401) {
//       console.log('Run ./onboarding.js to setup a new InfluxDB database.')
//     }
//     console.log('\nFinished ERROR')
//   });*/