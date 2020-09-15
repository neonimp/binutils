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

  private readNext(): number | null {
    let ret = Deno.readSync(this.file.rid, this.buff);
    let nPos = this.readCount * this.buffSize;
    if ((ret || 0) < this.buffSize) {
      this.buff = this.buff.slice(0, ret || 0);
    }
    this.posInFile = nPos;
    this.readCount++;
    return ret;
  }

  public set offset(at: number) {
    this.file.seekSync(at, Deno.SeekMode.Current);
  }

  public get offset() {
    return this.posInFile;
  }

  public get remainingBytes() {
    return this.fileSize - this.posInFile;
  }

  public next(): IteratorResult<FileChunk> {
    let ret = this.readNext();
    let data = Uint8Array.from(this.buff)
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
