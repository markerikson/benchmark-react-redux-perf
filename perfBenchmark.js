const express = require("express");
const puppeteer = require("puppeteer");
const tracealyzer = require('tracealyzer');
const spawn = require("cross-spawn");

const TRACE_FILE = 'trace.json';

const timeout = ms => new Promise(res => setTimeout(res, ms))


const runBuildTask = spawn.sync('npm', ['run', 'build'], {
    stdio: 'inherit',
});

console.log("Build completed!");


const app = express();

app.use(express.static('build'))

app.listen(9999, async () => {
    console.log('Example app listening on port 3000!');

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.evaluate(() => performance.setResourceTimingBufferSize(100000));
    //await page.tracing.start({path: TRACE_FILE});


    await page.goto('http://localhost:9999');

    await timeout(30000);

    //await page.tracing.stop();

    const perfEntries = JSON.parse(
        await page.evaluate(() => JSON.stringify(performance.getEntries()))
    );

    const fpsStatsEntries = JSON.parse(
        await page.evaluate(() => JSON.stringify(window.getFpsStats()))
    );

    await browser.close();

    const fpsValues = fpsStatsEntries.map(entry => entry.meta.details.FPS);
    console.log(fpsValues);

    //const metrics = tracealyzer(TRACE_FILE);

    //console.log(metrics);

    process.exit(0);
});