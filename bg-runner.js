import BGUtils from "bgutils-js"
import fs from "node:fs"

class BgRunner {
  page;

  constructor(browserPage) {
    this.page = browserPage;
  }

  async initialize(jnnChallengeData, jnnGenerateData) {
    await this._initializeUtils();
    await this.page.evaluate(async (challengeData, generateData) => {
      let bgChallenge = BGUtils.Challenge.parseChallengeData(challengeData);

      const interpreterJavascript = bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;

      const blob = new Blob([interpreterJavascript], { type: "text/javascript" });
      const blobUrl = URL.createObjectURL(blob);

      console.log(interpreterJavascript);

      try {
        // eval(interpreterJavascript);

        /* if (!document.getElementById(bgChallenge.interpreterHash)) {
          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.id = bgChallenge.interpreterHash;
          script.src = blobUrl;
          document.head.appendChild(script);
        } */

        const botguardClient = await BGUtils.BotGuardClient.create({
          globalObj: globalThis,
          globalName: bgChallenge.globalName,
          program: bgChallenge.program
        });

        let webPoSignalOutput = [];
        let botguardResponse = await botguardClient.snapshot({ webPoSignalOutput });

        let integrityToken = generateData[0];
        let tokenMinter = await BGUtils.WebPoMinter.create({ integrityToken }, webPoSignalOutput);

        console.log("Finished token creation for", integrityToken);

        window.tokenMinter = tokenMinter;
      } catch { console.log("uh oh") }

    }, jnnChallengeData, jnnGenerateData);
  }

  async mintToken(videoId) {
    return await this.page.evaluate(async (id) => {
      return await window.tokenMinter.mintAsWebsafeString(id);
    }, videoId);
  }

  /* async mintColdStartToken(identifier) {
    return await this.page.evaluate(async (id) => {
      return await window.tokenMinter.(id);
    }, videoId);
  } */

  async _initializeUtils() {
    const bundledCode = fs.readFileSync("./bg-utils/bundled.js").toString();
    await this.page.evaluate((moduleString) => {
      eval(moduleString);

      window.BGUtils = BGUtils;
    }, bundledCode);
  }

  async _test() {
    this.page.evaluate(() => {
      console.log(BGUtils);
    })
  }
}

export default BgRunner;