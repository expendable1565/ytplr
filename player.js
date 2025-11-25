import IntervalList from "./libs/interval-list.js";
import Speaker from "speaker"
import RepeatPromise from "./libs/repeat-promise.js";
import { spawn } from "child_process"
import { stdout } from "process";

import { UmpReader, CompositeBuffer } from "googlevideo/ump";
import * as Protos from "googlevideo/protos";
import { Readable } from "stream";
import { writeFileSync } from "fs";
import { getCueTimestamp } from "./libs/audio-processor.js";

const speaker = new Speaker({
  channels: 2,
  bitDepth: 16,
  sampleRate: 44100
})

class AsyncExtendedStream extends Readable {
  _instance;
  constructor(instance, options) {
    super(options);
    this._instance = instance;
  }

  _read(size) {
    (async () => {
      let result = await this._instance.readBytes(size);
      this.push(result);
    })()
  }
}

class Player {
  baseUrl;
  audioCache = new IntervalList();
  bytePosition = 0;
  contentLength = 0;
  bytePosition = 0;

  _ffmpegInstance;
  _streamingPipe;
  _requestAbort;

  _finishedRequest = new RepeatPromise();
  _requestAdded = new RepeatPromise();
  _mediaPlayerEvent = new RepeatPromise();

  _pendingRequests = [];
  _byteLookup;
  _granularByteLookup;
  _pendingBytes = Buffer.alloc(0);

  // creates an audio player based on fetched audio src url.
  constructor(baseUrl) {
    this.baseUrl = baseUrl;

    this.contentLength = baseUrl.searchParams.get("len");
    baseUrl.searchParams.delete("len");
  }

  static async create(baseUrl) {
    let instance = new Player(baseUrl);
    instance._requestLoop();

    let byteHeader = instance.audioCache.readBytes(0, 100000);
    while (!byteHeader) {
      instance.requestBytes(0, 2000, true);
      await instance._finishedRequest.wait();

      byteHeader = instance.audioCache.readBytes(0, 100000);
    }

    instance._byteLookup = getCueTimestamp(byteHeader);
    instance._granularLookup = instance._getByteLookup(byteHeader);
    console.log("Successfully looked up audio bytes! with a total value of", instance._byteLookup.length);

    instance._ffmpegInstance = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-f", "s16le",
      "-ac", "2",
      "-ar", "44100",
      "pipe:1"
    ]);

    instance._streamingPipe = new AsyncExtendedStream(instance);
    instance._streamingPipe.pipe(instance._ffmpegInstance.stdin);
    instance._ffmpegInstance.stdout.pipe(speaker);

    setInterval(() => {
      preload();
      // let [regionStart, regionEnd] = instance._getSegment(instance.bytePosition + 100000);
      // console.info("Preloading", regionStart, regionEnd);
      // if (instance.audioCache.readBytes(regionStart, regionEnd) != null) {
      //   console.log("Already");
      //   return;
      // }
      // instance.requestBytes(regionStart, regionEnd);
    }, 2000)


    return instance;
  }

  preload() {
    let [regionStart, regionEnd] = this._getSegment(this.bytePosition);
    let [nextRegionStart, nextRegionEnd] = this._getSegment(this.bytePosition + 100000);
    if (instance.audioCache.readBytes(regionStart, nextRegionEnd)) {
      return;
    }
    console.log("Preloading", regionStart, nextRegionEnd);
    instace.requestBytes(regionStart, nextRegionEnd);
  }

  async processTimeRegion(byteStart, byteEnd) {
    let headerRegion = instance.audioCache.readBytes(...instance._getSegment(0));
    if (!headerRegion) {
      console.log("Header not  loaded");
      return;
    }
    let bodyRegion = instance.audioCache.readBytes(byteStart, byteEnd);
    if (!bodyRegion) {
      console.log("Body not loaded");
      return;
    }

  }

  async readBytes(length) {
    /* if (this.audioCache.readBytes(this.bytePosition, this.bytePosition + 200000) != null) {
      return;
    }
    this.requestBytes(this.bytePosition, this.bytePosition + 500000); */



    while (this._pendingBytes.length < length) {
      if (this.bytePosition == this.contentLength) {
        console.log("Content finished. Waiting for media event.")
        await this._mediaPlayerEvent.wait();
      }
      let remainingLength = Math.min(length, this.contentLength - this.bytePosition);
      let finalPosition = this._findPacketEnd(this.bytePosition + remainingLength - 1);

      console.log("Reading buffer", `${this.bytePosition}-${finalPosition}`, remainingLength, length);
      let byteData = this.audioCache.readBytes(this.bytePosition, finalPosition);
      if (!byteData) {
        await this._finishedRequest.wait();
        continue;
      }
      console.log("Read Ok");
      this._pendingBytes = Buffer.concat([this._pendingBytes, byteData]);
      this.bytePosition = finalPosition + 1;
    }

    console.log("Buffer fill done.");

    let result = Buffer.from(this._pendingBytes.subarray(0, length));
    let remaining = Buffer.from(this._pendingBytes.subarray(length));
    this._pendingBytes = remaining;
    return result;
    /*if (finalPosition <= this.bytePosition) {
      // await this._mediaPlayerEvent.wait();
      return Buffer.alloc(0);
    }
    let result = this.audioCache.readBytes(this.bytePosition, finalPosition);
    console.log("Reading bytes", this.bytePosition, finalPosition, this.bytePosition + length);
    while (!result) {
      await this._finishedRequest.wait();
      result = this.audioCache.readBytes(this.bytePosition, finalPosition);
    }
    console.log("Read bytes success");
    this.bytePosition = finalPosition + 1;
    return result; */
  }

  _findPacketStart(byte) {
    let begin = 0;
    let end = this._granularByteLookup.length - 1;
    let result = -1;
    while (begin <= end) {
      let middle = Math.floor((begin + end) / 2);
      if (this._byteLookup[middle].byte <= byte) {
        result = middle;
        begin = middle + 1;
      } else {
        end = middle - 1;
      }
    }
    if (result == -1) {
      return 0;
    } else {
      return this._granularByteLookup[result].byte;
    }
  }

  _findPacketEnd(byte) {
    let begin = 0;
    let end = this._granularByteLookup.length - 1;
    let result = -1;
    while (begin <= end) {
      let middle = Math.floor((begin + end) / 2);
      if (this._byteLookup[middle].byte >= byte) {
        result =middle;
        end = middle - 1;
      } else {
        begin = middle + 1;
      }
    }
    if (result == -1) {
      return this.contentLength - 1;
    } else {
      return this._granularByteLookup[result].byte - 1;
    }
  }

  async _getByteLookup(headerString) {
    let resolveFunction;
    let waitingPromise = new Promise((resolve, reject) => {
      resolveFunction = resolve;
    })

    let ffprobeArgs = [
      "-i", "pipe:0",
      "-of", "csv",
      "-show_entries", "packet=pts_time,pos"
    ];
    let stdoutData = "";
    let process = spawn("ffprobe", ffprobeArgs);

    process.stdout.on("data", (data) => {
      stdoutData += data;
    });
    process.on("close", () => {
      resolveFunction();
    })

    process.stdin.write(headerString);
    process.stdin.end();

    await waitingPromise;

    writeFileSync("./data/test-output.txt", stdoutData);

    let result = [];
    let splits = stdoutData.split("\n");
    for (let split of splits) {
      let secondSplit = split.trim().split(",");
      if (secondSplit.length < 3) {
        continue;
      }
      let [header, packetTime, packetByte] = secondSplit;
      result.push({
        time: Number(packetTime),
        byte: Number(packetByte)
      })
    }

    return result;
  }

  requestBytes(startRange, endRange) {
    endRange = Math.min(endRange, this.contentLength - 1)
    let gaps = this.audioCache.findGaps(startRange, endRange);
    if (gaps.length == 0) {
      return;
    }
    console.log("Found gaps", gaps)
    this._pendingRequests.push(...gaps);
    this._requestAdded.resolve();
  }

  async _requestLoop() {
    while (this._requestAdded) {
      if (this._pendingRequests.length == 0) {
        console.log("Waiting for request...");
        await this._requestAdded.wait();
      }
      let nextRequest = this._pendingRequests.shift();
      let requestRange = `${nextRequest.range[0]}-${nextRequest.range[1]}`;
      console.log("Downloading byte range", requestRange);
      let cloned = new URL(this.baseUrl);
      cloned.searchParams.set("range", requestRange);
      let fetchResult;
      while (!fetchResult) {
        try {
          fetchResult = await fetch(cloned, {
            "method": "POST",
            "body": "x\u0000",
          })
        } catch (err) {
          console.log("Fetch encountered error", err)
        }
      }


      let rawResult = await fetchResult.arrayBuffer();
      let decodedResult = await getUMPDecodedAudioStream(rawResult);
      let bufferForm = Buffer.from(decodedResult);
      nextRequest.buffer[0] = bufferForm;
      console.info("Download OK", requestRange, bufferForm.length);
      this._finishedRequest.resolve();
    }
  }

  _getSegment(byteOffset) {
    let begin = 0, end = this._byteLookup.length - 1;
    let result = -1;
    while (begin <= end) {
      let mid = Math.floor((begin + end) / 2);
      if (this._byteLookup[mid].byte <= byteOffset) {
        result = mid;
        begin = mid + 1;
      } else {
        end = mid - 1;
      }
    }
    if (result == -1) {
      return [0, this._byteLookup[0].byte - 1], this._byteLookup;
    } else if (result == this._byteLookup.length - 1) {
      return [this._byteLookup[result].byte, this.contentLength - 1];
    } else {
      return [this._byteLookup[result].byte, this._byteLookup[result + 1].byte - 1];
    }
  }

  async seek(timePosition) {
    let begin = 0;
    let end = this._byteLookup.length - 1;
    let result = -1;
    while (begin <= end) {
      let middle = Math.floor((begin + end) / 2);
      if (this._byteLookup[middle].time <= timePosition) {
        result = this._byteLookup[middle].byte;
        begin = middle + 1;
      } else {
        end = middle - 1;
      }
    }
    if (result != -1) {
      this.bytePosition = result;
    }
  }
}

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
          // console.info('[MediaHeader]:', mediaHeader);
          break;
        }
        case 21: {
          handleMediaData(part.data.split(1).remainingBuffer.chunks[0]);
          break;
        }
        case 43: {
          redirect = Protos.SabrRedirect.decode(data);
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

  return mediaData;
}

export default Player;
