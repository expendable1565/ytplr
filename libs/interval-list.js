// my shoddy implementation of a cache tree

function searchLowerBound(targetList, position) {
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
}

function invertType(marker) {
  return {
    "type": marker.type == "start" ? "end" : "start",
    "duration": marker.duration
  }
}

class IntervalList {
  _intervals = [];
  _pendingInserts = [];
  _insertOffset = 0;
  _currentBuffer;

  constructor() {
  }

  // only returns the first gap, cause fuck you.
  // ill implement a proper one later.
  findGaps(startRange, endRange) {
    let gaps = [
      {"type": "start", "duration": startRange},
      {"type": "end", "duration": endRange}
    ];
    let lowerRange = searchUpperBound(this._intervals, startRange);
    let higherRange = searchLowerBound(this._intervals, endRange);
    
    if (lowerRange > endRange) {
      lowerRange = null;
    }
    if (higherRange < startRange) {
      higherRange = null;
    }

    lowerRange = lowerRange || higherRange;
    higherRange = higherRange || lowerRange;

    if (!lowerRange || !higherRange) {
      return gaps;
    }

    if (lowerRange == higherRange) {
      gaps.push(
        invertMarker(self._intervals[lowerRange])
      );
    }

    let lastBegin = gaps[0];
    let resultGaps = [];

    for (let i = lowerRange; i <= higherRange; i++) {
      let item = self._intervals[i];
      if (item.type == "end") {
        lastBegin = invertType(item);
      } else {
        if (lastBegin) {
          let beginDuration = lastBegin.duration + 1;
          let endDuration = item.duration - 1;
          lastBegin = null;
          if (endDuration < beginDuration) {
            continue;
          }
          return [beginDuration, endDuration, i]
          // this._pendingInserts.push([beginDuration, endDuration, i + this._insertOffset]);
        }
      }
    }
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
