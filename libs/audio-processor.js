// WEBM go kill yourself thankyou

import { readFileSync, writeFileSync } from "node:fs";
import { exec, execSync } from "node:child_process"

function timestampToSeconds(timestampStr) {
  let [main, millis] = timestampStr.split(".");
  let [hours, minutes, seconds] = main.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds + Number(millis)/1000000;
}

// tries to extract youtubes timestamp cues from its header file (first thousand bytes or so)
export function getCueTimestamp(bytes) {
    writeFileSync("./tmp/in.webm", bytes);
    let finalResult = ""
    execSync("mkvextract ./tmp/in.webm cues 0:./tmp/out.txt");
    let finalData = readFileSync("./tmp/out.txt").toString();
    let splits = finalData.split("\n");
    let result = [];
    for (let splitData of splits) {
        let secondSplit = splitData.trim().split(" ");
        console.log(secondSplit)
        if (secondSplit.length < 3) {
            continue;
        }
        let [timestampStr, _, clusterString] = secondSplit;        
        let [timestampIndex, timestamp] = timestampStr.split("=");
        let [clusterIndex, byteIndex] = clusterString.split("=");
        result.push({
            "time": timestampToSeconds(timestamp),
            "byte": byteIndex
        })
    }
    return result;
}