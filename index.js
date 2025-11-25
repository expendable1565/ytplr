import bgutils from "bgutils-js"
import fs from "node:fs"
import BrowserInstance from "./browser.js";
import BgRunner from "./bg-runner.js"
import {getBestAudioStream, getAudioBuffer} from "./streams.js"
import Player from "./player.js";
import ChallengeSolver from "./libs/challenge-solver.js";

// let challengeString = fs.readFileSync("./data/challenge_string.txt");
// let result = bgutils.Challenge.descramble(challengeString);
// console.log(result);

class YTMainPlayer {
  bgRunner = null;
  browserInstance = null;
  currentPlayer = null;
  challengeSolver = null;

  constructor(bgRunner, browserInstance) {
    
  }

  async create() {
    let browserInstance = await BrowserInstance.create();
    await browserInstance.startNavigate();

    let bgRunner = new BgRunner(browserInstance.mainPage);
    await bgRunner.initialize(browserInstance.jnnChallengeData, browserInstance.jnnGenerateData);

    let challengeSolver = new ChallengeSolver(this);

    return new YTMainPlayer(bgRunner, browserInstance);
  }

  async _onInput(data) {
    let stringData = data.toString().split(" ");
    if (stringData.length == 0) {
      return;
    }
    if (stringData[0] == "play") {
      if (stringData.length < 2) {
        console.log("Expecting 2 arguments")
        return;
      }
      this.currentPlayer = new Player(this, )
    }
  }
}

// Initialize browser and navigate to YTMusic (gather challenge data)

let browserInstance = await BrowserInstance.create();
await browserInstance.startNavigate();

let bgRunner = new BgRunner(browserInstance.mainPage);
await bgRunner.initialize(browserInstance.jnnChallengeData, browserInstance.jnnGenerateData);
// bgRunner._test();

let currentPlayer;

console.log("Startup success! try inputting a video id, and ill download it for you!");

process.stdin.on('data', async (line) => {
  let splits = line.toString().split(" ")
  if (currentPlayer && splits.length >= 2 && splits[0] == "Seek") {
    currentPlayer.seek(Number(splits[1]));
    return;
  }
  let stringLine = line.toString().trim();
  let result = await bgRunner.mintToken(stringLine);
  console.log("The result is:", result, "Beginning download.");

  let bestUrl = await getBestAudioStream(browserInstance, stringLine, bgRunner);
  currentPlayer = await Player.create(bestUrl);
  /* let resultBuffer = await getAudioBuffer(bestUrl);
  console.log("Finished downloading buffer, size", resultBuffer.length);

  fs.writeFileSync(`./${stringLine}.webm`, resultBuffer); */
})

process.on('SIGINT', () => {
  console.log("Received sigint!");
  browserInstance?.destroy();
  process.exit();
});

// browserInstance = await BrowserInstance.create();

// (async () => {setInterval(() => {}, 100)})()
