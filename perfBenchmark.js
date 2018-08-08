const express = require("express");
const puppeteer = require("puppeteer");
const tracealyzer = require('tracealyzer');
const spawn = require("cross-spawn");

const fs = require("fs");

const TRACE_FILE = 'trace.json';

const VERSIONS = ["5.0.7", "4.4.9"];

const timeout = ms => new Promise(res => setTimeout(res, ms))


/*
const runBuildTask = spawn.sync('npm', ['run', 'build'], {
    stdio: 'inherit',
});

console.log("Build completed!");
*/




const app = express();

app.use(express.static('build'))

app.listen(9999, async () => {
    const browser = await puppeteer.launch();

    const versionPerfEntries = {};

    for(let version of VERSIONS) {
        const sourceFilename = `react-redux-${version}.min.js`;
        fs.copyFileSync(sourceFilename, "build/react-redux.min.js");

        const page = await browser.newPage();
        await page.evaluate(() => performance.setResourceTimingBufferSize(100000));

        console.log(`Loading page for version ${version}...`)
        await page.goto('http://localhost:9999');

        await timeout(30000);

        //await page.tracing.stop();

        const perfEntries = JSON.parse(
            await page.evaluate(() => JSON.stringify(performance.getEntries()))
        );

        const fpsStatsEntries = JSON.parse(
            await page.evaluate(() => JSON.stringify(window.getFpsStats()))
        );

        const fpsValues = fpsStatsEntries.map(entry => entry.meta.details.FPS);

        versionPerfEntries[version] = fpsValues;

        await page.close();
    }

    await browser.close();


    console.log(versionPerfEntries);

    //const metrics = tracealyzer(TRACE_FILE);

    //console.log(metrics);

    process.exit(0);
});