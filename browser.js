import puppeteer_stealth from "puppeteer-extra-plugin-stealth"
import puppeteer from "puppeteer-extra";
import { PuppeteerNode } from "puppeteer";
import fs from "node:fs";

puppeteer.use(puppeteer_stealth());

class BrowserInstance {
  browser;
  mainPage;

  videoPlaybackParams = null;
  contextBody = null;
  contextHeaders = null;

  jnnChallengeData = null;
  jnnGenerateData = null;

  constructor(browser, mainPage) {
    this.browser = browser;
    this.mainPage = mainPage;
  }

  static async create() {
    let newBrowser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox'
      ]
    });
    let newPage = await newBrowser.newPage();
    newPage.setViewport({ width: 1280, height: 720 });

    return new BrowserInstance(newBrowser, newPage);
  }

  // obtains the VM, etc, bla bla bla
  // Does not make aditional requests since the response is already handled by
  // YT Music, only needs to generate functions required for minting.
  async startNavigate() {
    let resolveFunction;
    let finishedPromise = new Promise(resolve => resolveFunction = resolve);
    this.mainPage.setRequestInterception(true);
    this.mainPage.on('response', async (resp) => {
      if (resp.url().includes("jnn") && resp.request().method() !== "OPTIONS") {
        if (resp.url().includes("Create")) {
          let challengeResp = await resp.json();
          this.jnnChallengeData = challengeResp;
        } else if (resp.url().includes("GenerateIT")) {
          let challengeResp = await resp.json();
          this.jnnGenerateData = challengeResp;

          // this is the second one, so it should have loaded the previous Create tokens.
          // resolveFunction();
        }
      } else if (resp.url().includes("base.js")) {
        let scriptSrc = await resp.text();
        fs.writeFileSync("./data/base.js", scriptSrc);
      }
    });
    this.mainPage.on('request', async (req) => {
      if (req.url().includes("player?prettyPrint")) {
        let requestBody = JSON.parse(await req.fetchPostData());
        let headers = await req.headers();

        for (let key of Object.keys(requestBody)) {
          if (!key.includes("context")) {
            delete requestBody[key];
          }
        }

        this.contextBody = requestBody;
        this.contextHeaders = headers;

        resolveFunction();
      }
      req.continue();
    });
    await this.mainPage.goto("https://music.youtube.com/watch?v=I8sUC-dsW8A", { waitUntil: "networkidle0" });
    return finishedPromise;
  }

  async getCookieString() {
    const cookies = await this.mainPage.cookies();
    let cookieString = '';
    for (let cookie of cookies) {
      cookieString += `${cookie.name}=${cookie.value}; `;
    }
    cookieString.trimEnd().replace(/;$/, '');
    return cookieString;
  }

  async getCookie(name) {
    for (let cookie of await this.mainPage.cookies()) {
      if (cookie.name == name) {
        return cookie.value;
      }
    }
  }

  async destroy() {
    await this.browser.close();
  }

  async evaluateJavascript(scriptString) {
    return this.mainPage.evaluate(scriptString);
  }
}

export default BrowserInstance;
