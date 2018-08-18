const express = require("express");
const puppeteer = require("puppeteer");
const tracealyzer = require('tracealyzer');
const spawn = require("cross-spawn");

const fs = require("fs");

const TRACE_FILE = 'trace.json';

const VERSIONS = ["5.0.7", "6.0-mark", "6.0-greg"];

const timeout = ms => new Promise(res => setTimeout(res, ms))



const runBuildTask = spawn.sync('npm', ['run', 'build'], {
    stdio: 'inherit',
});

console.log("Build completed!");



const arrayStats = {
    max: function(array) {
        return Math.max.apply(null, array);
    },

    min: function(array) {
        return Math.min.apply(null, array);
    },

    range: function(array) {
        return arrayStats.max(array) - arrayStats.min(array);
    },

    midrange: function(array) {
        return arrayStats.range(array) / 2;
    },

    sum: function(array) {
        var num = 0;
        for (var i = 0, l = array.length; i < l; i++) num += array[i];
        return num;
    },

    mean: function(array) {
        return arrayStats.sum(array) / array.length;
    },

    median: function(array) {
        array.sort(function(a, b) {
            return a - b;
        });
        var mid = array.length / 2;
        return mid % 1 ? array[mid - 0.5] : (array[mid - 1] + array[mid]) / 2;
    },

    modes: function(array) {
        if (!array.length) return [];
        var modeMap = {},
            maxCount = 0,
            modes = [];

        array.forEach(function(val) {
            if (!modeMap[val]) modeMap[val] = 1;
            else modeMap[val]++;

            if (modeMap[val] > maxCount) {
                modes = [val];
                maxCount = modeMap[val];
            }
            else if (modeMap[val] === maxCount) {
                modes.push(val);
                maxCount = modeMap[val];
            }
        });
        return modes;
    },

    variance: function(array) {
        var mean = arrayStats.mean(array);
        return arrayStats.mean(array.map(function(num) {
            return Math.pow(num - mean, 2);
        }));
    },

    standardDeviation: function(array) {
        return Math.sqrt(arrayStats.variance(array));
    },

    meanAbsoluteDeviation: function(array) {
        var mean = arrayStats.mean(array);
        return arrayStats.mean(array.map(function(num) {
            return Math.abs(num - mean);
        }));
    },

    zScores: function(array) {
        var mean = arrayStats.mean(array);
        var standardDeviation = arrayStats.standardDeviation(array);
        return array.map(function(num) {
            return (num - mean) / standardDeviation;
        });
    }
};

// Function aliases:
arrayStats.average = arrayStats.mean;



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

        // skip first value = it's usually way lower due to page startup
        const fpsValuesWithoutFirst = fpsValues.slice(1);

        const average = arrayStats.average(fpsValuesWithoutFirst);

        const fps = {average, values : fpsValues}

        versionPerfEntries[version] = {fps, profile : categories};
    }

    await browser.close();

    Object.keys(versionPerfEntries).sort().forEach(version => {
        const versionResults = versionPerfEntries[version];

        const {fps, profile} = versionResults;

        console.log(version);
        console.log("  FPS (average, values): ", fps.average, "; ", fps.values);
        console.log("  Profile: ", profile)
    })


    process.exit(0);
});