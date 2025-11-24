import bgutils from "bgutils-js"
import fs from "node:fs"
import BrowserInstance from "./browser.js";
import BgRunner from "./bg-runner.js"
import {getBestAudioStream, getAudioBuffer} from "./streams.js"

let challengeString = fs.readFileSync("./data/challenge_string.txt");
let result = bgutils.Challenge.descramble(challengeString);
console.log(result);

// Initialize browser and navigate to YTMusic (gather challenge data)

let browserInstance = await BrowserInstance.create();
await browserInstance.startNavigate();

let bgRunner = new BgRunner(browserInstance.mainPage);
await bgRunner.initialize(browserInstance.jnnChallengeData, browserInstance.jnnGenerateData);
// bgRunner._test();

console.log("Startup success! try inputting a video id, and ill download it for you!");

process.stdin.on('data', async (line) => {
  let stringLine = line.toString().trim();
  let result = await bgRunner.mintToken(stringLine);
  console.log("The result is:", result, "Beginning download.");

  let bestUrl = await getBestAudioStream(browserInstance, stringLine, bgRunner);
  let resultBuffer = await getAudioBuffer(bestUrl);
  console.log("Finished downloading buffer, size", resultBuffer.length);

  fs.writeFileSync(`./${stringLine}.webm`, resultBuffer);
})

process.on('SIGINT', () => {
  console.log("Received sigint!");
  browserInstance?.destroy();
  process.exit();
});

// browserInstance = await BrowserInstance.create();

// (async () => {setInterval(() => {}, 100)})()
