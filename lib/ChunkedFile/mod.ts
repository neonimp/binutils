/**
 *  Copyright 2020 Matheus Xavier
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

export class FileChunk {
  constructor(public chunk: Uint8Array, public len: number) {}
}

export class ChunkedFile implements Iterator<FileChunk> {
  private buff: Uint8Array;
  private buffSize: number;
  private readCount: number;
  private posInFile: number;
  private file: Deno.File;
  public readonly fileSize: number;
  public constructor(
    path: string,
    chunkSize: number,
    offset?: number,
  ) {
    // Get stat info on the file
    try {
      const fstat = Deno.statSync(path);
      if (!fstat.isFile) {
        throw new Error("Cannot read by chunks on non file entity");
      }
      this.fileSize = fstat.size;
    } catch (error) {
      throw Error(
        `Could not stat the file ${path}, with error: ${error.message}`,
      );
    }
    this.file = Deno.openSync(path, { read: true });
    this.buff = new Uint8Array(chunkSize);
    this.buffSize = chunkSize;
    // Either 0 or the current offset
    this.posInFile = offset || 0;
    this.readCount = 0;
    // Seek to the offset otherwise ensure seek is at 0
    this.file.seekSync(this.posInFile, Deno.SeekMode.Start);
  }

  private readChunk(): number | null {
    // Read the file by a chunk's lenght
    let ret = Deno.readSync(this.file.rid, this.buff);
    this.posInFile = this.readCount * this.buffSize;
    /* if the read size is smaller than the buffer size slice the buffer to the read size
       this is due to the fact that the buffer if read less than it's size will remain with garbage in the end
       so this will snip the buffer to whatever size is read.
     */
    if ((ret || 0) < this.buffSize) {
      this.buff = this.buff.slice(0, ret || 0);
    }
    this.readCount++;
    return ret;
  }

  /**
   * Read the file at the specified buffer multiple or
   * @param pos offset in multiples of buffer size this is preferred over offset must be < than lenght
   * @param offset offset in bytes
   * @param seekFrom Deno.SeekMode to use defaults to Start
   */
  private _readAt(
    pos?: number,
    offset?: number,
    seekFrom: Deno.SeekMode = Deno.SeekMode.Start,
  ): number | null {
    if (pos && pos < this.lenght) {
      this.file.seekSync(pos * this.buffSize, seekFrom);
    } else if (offset) {
      this.file.seekSync(offset, seekFrom);
    } else {
      throw Error("need either `pos` or `offset`");
    }
    return this.readChunk();
  }

  public set offset(at: number) {
    this.file.seekSync(at, Deno.SeekMode.Current);
  }

  public get offset(): number {
    return this.posInFile;
  }

  public get remainingBytes(): number {
    return this.fileSize - this.posInFile;
  }

  /**
   * @returns returns buffSize/fileSize
   */
  public get lenght(): number {
    return Math.floor(this.fileSize / this.buffSize);
  }

  public next(): IteratorResult<FileChunk> {
    let ret = this.readChunk();
    let data = Uint8Array.from(this.buff);
    if (ret === null) {
      return {
        done: true,
        value: null,
      };
    }
    return {
      done: false,
      value: new FileChunk(data, data.length),
    };
  }

  public readAt(index: number): FileChunk {
    if (this._readAt(index) !== null) {
      let data = Uint8Array.from(this.buff);
      return new FileChunk(data, data.length);
    } else {
      throw Error("read error");
    }
  }

  public forEach(fun: CallableFunction) {
    while (true) {
      let next = this.next();
      if (next.done) {
        break;
      }
      fun(next.value);
    }
  }

  public dispose() {
    this.file.close();
    this.buff.fill(0);
  }
}
