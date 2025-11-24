// my shoddy implementation of a cache tree

import IntervalTree from "@flatten-js/interval-tree";

/* function searchLowerBound(targetList, position) {
  let left = 0;
  let right = targetList.length - 1;
  let res = null;
  while (left <= right) {
    let mid = (left + right) / 2;
    if (targetList[mid].position >= position) {
      res = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return res;
}

function searchUpperBound(targetList, position) {
  let left = 0;
  let right = targetList.length - 1;
  let res = null;
  while (left <= right) {
    let mid = (left + right) / 2;
    if (targetList[mid].position <= position) {
      res = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return res;
} */

function invertType(marker) {
  return {
    "type": marker.type == "start" ? "end" : "start",
    "duration": marker.duration
  }
}

class IntervalList {
  _intervals;
  _currentBuffer;

  constructor() {
    this._intervals = new IntervalTree();
  }

  // only returns the first gap, cause fuck you.
  // ill implement a proper one later.
  findGaps(startRange, endRange) {
    let knownGaps = [
      { "type": "end", "duration": startRange - 1 },
      { "type": "start", "duration": endRange + 1 }
    ]
    let gapResult = []
    this._intervals.search([startRange, endRange], (v, k) => {
      if (k.low > startRange) {
        knownGaps.push({ "type": "start", duration: k.low });
      }
      if (k.high < endRange) {
        knownGaps.push({ "type": "end", duration: k.high });
      }
    });

    knownGaps.sort((a, b) => a.duration - b.duration);

    let lastGapDuration = null;
    for (let gapMarker of knownGaps) {
      if (gapMarker.type == "end") {
        lastGapDuration = gapMarker.duration + 1;
      } else if (gapMarker.type == "start" && lastGapDuration != null) {
        if (lastGapDuration == gapMarker.duration) {
          lastGapDuration = null;
          continue;
        }
        gapResult.push({
          range: [lastGapDuration, gapMarker.duration - 1],
          buffer: [Buffer.alloc(0)] // reference "hack"
        });
        lastGapDuration = null;
      }
    }

    for (let gap of gapResult) {
      this._intervals.insert(gap.range, gap.buffer);
    }

    return gapResult;
  }

  removeGaps(gapData) {
    for (let gap of gapData) {
      this._intervals.remove(gap);
    }
  }

  readBytes(startRange, endRange) {
    let unsorted = this._intervals.search([startRange, endRange], (value, key) => {
      return {
        "start": key.low,
        "end": key.high,
        "buffer": value
      }
    })

    unsorted.sort((a, b) => a.start - b.start);

    if (unsorted.length == 0) {
      return null;
    }
    
    let result = Buffer.alloc(0);
    let currentStart = startRange;
    let currentEnd = 0;

    for (let gap of unsorted) {
      // console.log(gap, gap.buffer);
      if (gap.start > currentStart) {
        return null;
      }
      if (gap.buffer[0].length == 0) {
        return null
      }
      currentEnd = Math.min(endRange, gap.end);
      let segmentOffset = currentStart - gap.start;
      let segmentEndOffset = currentEnd - gap.start;
      let partial = gap.buffer[0].slice(segmentOffset, segmentEndOffset + 1);
      result = Buffer.concat([result, partial]);

      currentStart = currentEnd + 1;
    }

    if (currentEnd != endRange) {
      return null;
    }

    return result;
  }

  addSegment(insertData, buffer) {
    this._intervals.splice(insertData[2], 0, {
      "type": "start",
      "duration": insertData[0],
      "buffer": buffer
    }, {
      "type": "end",
      "duration": insertData[1]
    })
  }

  findAudioBuffer(byteStart, byteEnd) {
    let lowerBound = searchLowerBound(self._intervals, byteStart);
    if (!lowerBound) {
      return null;
    }
    if (self._intervals[lowerBound].type == "end") {
      lowerBound--;
    }
    if (self.__intervals[lowerBound + 1].duration < byteEnd) {
      return null;
    }
    return self.__intervals[lowerBound].buffer;
  }

  clearPendingInserts() {

  }

}

export default IntervalList;
