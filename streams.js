import getSigFunctions from "./data/parser-script.js";
import fs from "node:fs"
import { UmpReader, CompositeBuffer } from "googlevideo/ump";
import * as Protos from "googlevideo/protos"

async function getUMPDecodedAudioStream(arrayBuffer) {
  const googUmp = new UmpReader(new CompositeBuffer([new Uint8Array(arrayBuffer)]));

  let mediaData = new Uint8Array(0);
  let redirect

  const handleMediaData = async (data) => {
    const combinedLength = mediaData.length + data.length;
    const tempMediaData = new Uint8Array(combinedLength);

    tempMediaData.set(mediaData);
    tempMediaData.set(data, mediaData.length);

    mediaData = tempMediaData;
  };;

  googUmp.read((part) => {
    try {
      const data = part.data.chunks[0];
      switch (part.type) {
        case 20: {
          const mediaHeader = Protos.MediaHeader.decode(data);
          console.info('[MediaHeader]:', mediaHeader);
          break;
        }
        case 21: {
          handleMediaData(part.data.split(1).remainingBuffer.chunks[0]);
          break;
        }
        case 43: {
          // redirect = Protos.SabrRedirect.decode(data);
          console.info('[SABRRedirect]: SHIT FUCK', redirect);
          break;
        }
        case 58: {
          const streamProtectionStatus = Protos.StreamProtectionStatus.decode(data);
          switch (streamProtectionStatus.status) {
            case 1:
              console.info('[StreamProtectionStatus]: Ok');
              break;
            case 2:
              console.error('[StreamProtectionStatus]: Attestation pending');
              break;
            case 3:
              console.error('[StreamProtectionStatus]: Attestation required');
              break;
            default:
              break;
          }
          break;
        }
      }
    } catch (error) {
      console.error('An error occurred while processing the part:', error);
    }
  });

  if (redirect)
    return handleRedirect(redirect);

  return mediaData;
  /* 
    if (mediaData.length)
      mediaData = mediaData; */
}

export async function solveSignatures(rawUrl, videoId, poTokenMinter) {
  let nSignature = rawUrl.searchParams.get("n");
  let newN = sigFunctions.n(nSignature);
  rawUrl.searchParams.set("n", newN);
  rawUrl.searchParams.set("pot", await poTokenMinter.mintToken(visitorId));
  rawUrl.searchParams.set("ump", "1");
  rawUrl.searchParams.set("srfvp", 1)

  console.log("Finish proc URL", rawUrl.searchParams)
}

export async function getBestAudioStream(browserInstance, videoId, poTokenMinter) {

  let baseFile = fs.readFileSync("./data/base.js");
  let sigFunctions = getSigFunctions(baseFile.toString());
  let baseContext = browserInstance.contextBody;

  let visitorId = videoId.trim();

  let newRequestObject = {};
  Object.assign(newRequestObject, baseContext);
  newRequestObject.videoId = videoId.trim();

  let headerObject = {
    Cookie: await browserInstance.getCookieString(),
    "content-type": "application/json"
  }
  let newHeaderObject = {};
  Object.assign(newHeaderObject, browserInstance.baseHeaders);
  Object.assign(newHeaderObject, headerObject);

  console.log("Sending request, headers:");
  console.log(newHeaderObject);
  console.log("Body");
  console.log(newRequestObject);

  const resp = await fetch("https://music.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: newHeaderObject,
    body: JSON.stringify(newRequestObject)
  })

  const jsonData = await resp.json();

  console.log("Received data", jsonData);

  const adaptiveStreams = jsonData.streamingData.adaptiveFormats;
  let bestStream = null;
  let streamLen = null;
  for (let data of adaptiveStreams) {
    if (data.audioQuality == "AUDIO_QUALITY_MEDIUM") {
      bestStream = data;
    }
  }

  console.log(`Found best stream with itag ${bestStream.itag} len ${bestStream.contentLength}`);


  let rawUrl;
  if (bestStream.signatureCipher) {
    let signatureData = new URLSearchParams(bestStream.signatureCipher);
    let rawSig = signatureData.get("s");
    let url = new URL(signatureData.get("url"));

    url.searchParams.set("sig", sigFunctions.sig(rawSig));
    rawUrl = url;
    console.log("URL has signature cipher!");
  } else {
    rawUrl = new URL(bestStream.url);
    console.log("URL is normal");
  }

  rawUrl.searchParams.set("len", bestStream.contentLength);
  let nSignature = rawUrl.searchParams.get("n");
  let newN = sigFunctions.n(nSignature);
  rawUrl.searchParams.set("n", newN);
  rawUrl.searchParams.set("pot", await poTokenMinter.mintToken(visitorId));
  rawUrl.searchParams.set("ump", "1");
  rawUrl.searchParams.set("srfvp", 1)

  console.log("Finish proc URL", rawUrl.searchParams)

  return rawUrl;
}

export async function getAudioBuffer(sourceUrl) {
  let downloadedBytes = 0;
  let supposedBytes = 0;
  let downloadSize = 300023;

  let resultBuffer = Buffer.alloc(0);
  sourceUrl.searchParams.set("ump", "1");
  sourceUrl.searchParams.set("srfvp", "1")

  while (supposedBytes >= downloadedBytes) {
    let rangeEnd = downloadedBytes + downloadSize - 1;
    sourceUrl.searchParams.set("range", `${resultBuffer.length}-${resultBuffer.length + downloadSize - 1}`);
    let result = await fetch(sourceUrl, {
      "method": "POST",
      "body": "x\u0000",
    })

    if (result.status != 200) {
      console.log("Something happened with code", result.status, "downloading range", downloadedBytes, rangeEnd);
      continue;
    }

    let resultArray = await result.arrayBuffer();
    let decodedArray = await getUMPDecodedAudioStream(resultArray);
    let newBuffer = Buffer.from(decodedArray);
    resultBuffer = Buffer.concat([resultBuffer, newBuffer]);
    console.log("Successfully downloaded", newBuffer.length, "bytes, total", resultBuffer.length);

    if (downloadSize > newBuffer.length) {
      break;
    }
  }
  console.log("Done!");
  return resultBuffer;
}

async function getAudioBytes(sourceUrl) {
  await inner_client.waitForBrowser();
  let supposedLength = 0;
  let actualLength = 0;

  // sourceUrl.searchParams.set("ump", "1");
  sourceUrl.searchParams.set("srfvp", "1");
  sourceUrl.searchParams.set("pot", "MlPRXE6DD_ucbtFgjo9kgEMIzPTqZWdFuMeC4JOL2ZKQrO8JRSx4LWIfStQR8zd6OGS1aY9LdddbtcJ2iMVzTdPjLtQqHDB1vWvv6JjdBYKjPWVGIA==");

  let totalResult = Buffer.alloc(0);

  let currentPosition = 0;
  let rn = 2;
  let rbuf = 0;
  // await getWait(5000);
  await new Promise(resolve => setTimeout(resolve, 5000 + Math.floor(Math.random() * 500)));
  while (true) {
    let downloadSize = 1024567;
    // let downloadSize = downloadSizeStatic + Math.floor(Math.random() * 10000);
    // supposedLength = Math.min(supposedLength + downloadSize, totalLength);
    sourceUrl.searchParams.set("range", `${actualLength}-${actualLength + downloadSize - 1}`);

    for (let [key, value] of inner_client.baseQueryParams.entries()) {
      if (!["cpn", "cver"].includes(key)) {
        continue;
      }
      if (!sourceUrl.searchParams.get(key)) {
        sourceUrl.searchParams.set(key, value);
        console.log("Set", key, value)
      }
    }

    // sourceUrl.searchParams.set("rn", rn);
    // sourceUrl.searchParams.set("rbuf", rbuf);
    rn += 2;
    rbuf += 1000;
    let result = await fetch(sourceUrl, {
      method: "POST",
      body: "x\u0000"
    });

    let resultBuffer = Buffer.from(await result.arrayBuffer());
    totalResult = Buffer.concat([totalResult, resultBuffer]);

    let resultLength = result.headers.get("length") || 0;

    if (result.status == 200) {
      actualLength += downloadSize;
      currentPosition += downloadSize;
    }

    console.log("Download finished", result.status, totalResult.length, sourceUrl.searchParams.get('range'));
    console.log("Discrepancy", totalResult.length - actualLength);
    console.log("POT", poToken);
    if (totalResult.length != actualLength) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.floor(Math.random() * 500)));
  }

  console.log("Finished downloading with size", totalResult.length, totalLength)

  return totalResult;
}