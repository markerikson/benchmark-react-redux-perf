const express = require("express");
const puppeteer = require("puppeteer");
const tracealyzer = require('tracealyzer');
const spawn = require("cross-spawn");

const TRACE_FILE = 'trace.json';


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
    await page.tracing.start({path: TRACE_FILE});
    await page.goto('http://localhost:9999');
    await page.tracing.stop();

    await browser.close();

    const metrics = tracealyzer(TRACE_FILE);

    console.log(metrics);

    process.exit(0);
});