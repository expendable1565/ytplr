import IntervalList from "./libs/interval-list.js";
import Speaker from "speaker"

const speaker = new Speaker({
  channels: 2,
  bitDepth: 16,
  sampleRate: 44100
})

class Player {
  baseUrl;
  audioCache = new IntervalList();
  bytePosition = 0;
  contentLength = 0;

  _ffmpegInstance;
  _requestAbort;
  _finishedRequest;

  _byteLookup;

  // creates an audio player based on fetched audio src url.
  constructor(baseUrl) {
    this.baseUrl = baseUrl;

    let contentLength = baseUrl.searchParams.get("len");
    baseUrl.searchParams.delete("len");
  }

  async new(baseUrl) {
    let base = new Player(baseUrl);
  }


}
