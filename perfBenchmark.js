const express = require("express");
const puppeteer = require("puppeteer");
const tracealyzer = require('tracealyzer');
const spawn = require("cross-spawn");

const fs = require("fs");

const TRACE_FILE = 'trace.json';

const VERSIONS = ["5.0.7", "6.0-test2"];

const timeout = ms => new Promise(res => setTimeout(res, ms))



const runBuildTask = spawn.sync('npm', ['run', 'build'], {
    stdio: 'inherit',
});

console.log("Build completed!");





const app = express();

app.use(express.static('build'))

async function capturePageStats(browser, url, traceFilename, delay = 30000) {
    const page = await browser.newPage();
    await page.evaluate(() => performance.setResourceTimingBufferSize(100000));

    let fpsValues, traceMetrics;

    const trace = !!traceFilename;

    //console.log(`Loading page for version ${version}...`)
    await page.goto(url);

    if(trace) {
        await page.tracing.start({path : traceFilename});
    }

    await timeout(delay);

    if(trace) {
        await page.tracing.stop();
        traceMetrics = tracealyzer(traceFilename);
    }

    const perfEntries = JSON.parse(
        await page.evaluate(() => JSON.stringify(performance.getEntries()))
    );

    const fpsStatsEntries = JSON.parse(
        await page.evaluate(() => JSON.stringify(window.getFpsStats()))
    );

    fpsValues = fpsStatsEntries.map(entry => entry.meta.details.FPS);

    //versionPerfEntries[version] = fpsValues;
    await page.close();

    return {fpsValues, traceMetrics, perfEntries};
}

app.listen(9999, async () => {
    const browser = await puppeteer.launch();

    const versionPerfEntries = {};

    const URL = 'http://localhost:9999';

    for(let version of VERSIONS) {
        const sourceFilename = `react-redux-${version}.min.js`;
        fs.copyFileSync(sourceFilename, "build/react-redux.min.js");

        const outputSourcemapFilename = "build/react-redux.min.js.map";
        if(fs.existsSync(outputSourcemapFilename)) {
            fs.unlinkSync(outputSourcemapFilename);
        }

        const sourcemapFilename = sourceFilename + ".map";

        if(fs.existsSync(sourcemapFilename)) {
            fs.copyFileSync(sourcemapFilename, outputSourcemapFilename);
        }



        console.log(`Checking max FPS for version ${version}...`)
        const fpsRunResults = await capturePageStats(browser, URL, null);

        console.log(`Running perf trace for version ${version}...`);
        const traceFilename = `trace-${version}.json`;
        const traceRunResults = await capturePageStats(browser, URL, traceFilename);

        const {fpsValues} = fpsRunResults;
        const {categories} = traceRunResults.traceMetrics.profiling;

        versionPerfEntries[version] = {fpsValues, profile : categories};
    }

    await browser.close();


    console.log(versionPerfEntries);

    process.exit(0);
});