import { parse } from "https://deno.land/std/flags/mod.ts";
import { ChunkedFile, FileChunk } from "../src/ChunkedFile/mod.ts";

function buf2hex(arr: Uint8Array): string {
  let ret = new Array<string>();
  let i = 0;
  let codec = new TextDecoder("utf-8");
  for (const v in arr) {
    ret.push(`0x${arr[v].toString(16)}`);
    i++;
    if (i % 16 === 0) {
      ret.push("\n");
    }
  }
  return ret.join(" ");
}

function main() {
  const args = parse(Deno.args);
  if (args.fname === undefined) {
    console.error("need --fname argument");
    Deno.exit(1);
  }
  const cf = new ChunkedFile(args.fname, args.csiz || 1024);
  let codec = new TextDecoder("utf-8");
  console.log(`filesize ${cf.fileSize}`);
  cf.forEach((element: FileChunk) => {
    let text = "";
    if (args.x) {
      text = buf2hex(element.chunk);
    } else {
      text = codec.decode(element.chunk);
    }
    console.log("===============================");
    console.log(`remaining ${cf.remainingBytes}`);
    console.log(`currently at pos ${cf.offset} of ${cf.fileSize}`);
    console.log("===============================");
    console.log(text);
  });
  cf.dispose();
}

main();
