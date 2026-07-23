/**
 * Parser for the `multipart/mixed` responses RCRAInfo returns from
 * attachment-related endpoints (e.g. GET /emanifest/manifest/{mtn}/attachments).
 *
 * Ported from EPA's own reference implementation in
 * https://github.com/USEPA/e-manifest/blob/master/emanifest-js/src/parse.ts
 * (itself adapted from the `parse-multipart` npm package) since RCRAInfo's
 * multipart framing is a specific, slightly nonstandard RFC 1341 variant —
 * safer to reuse EPA's own parser than to hand-roll a new one.
 */

export interface MultipartOutputPart {
  contentType: "application/json" | "application/octet-stream";
  contentDisposition?: string;
  data: Buffer | unknown;
}

interface InputPart {
  contentTypeHeader: string;
  contentDispositionHeader: string;
  data: number[];
}

enum ParsingState {
  INIT,
  READING_HEADERS,
  READING_INFO,
  READING_DATA,
  READING_PART_SEPARATOR,
  POST_READING_DATA,
}

export function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=([^;]+)/);
  return match ? match[1] : null;
}

function checkBoundary(headerBoundary: string): string {
  if (!headerBoundary) {
    throw new Error("headerBoundary is undefined");
  }
  return headerBoundary.startsWith("--") ? headerBoundary : "--" + headerBoundary;
}

export function parseMultipartMixed(
  multipartBodyBuffer: Buffer,
  headerBoundary: string
): MultipartOutputPart[] {
  const boundary = checkBoundary(headerBoundary);
  let lastLine = "";
  let header = "";
  let info = "";
  let state: ParsingState = ParsingState.INIT;
  let buffer: number[] = [];
  const allParts: MultipartOutputPart[] = [];

  for (let i = 0; i < multipartBodyBuffer.length; i++) {
    const oneByte = multipartBodyBuffer[i];
    const prevByte = i > 0 ? multipartBodyBuffer[i - 1] : null;
    const newLineDetected = oneByte === 0x0a && prevByte === 0x0d;
    const newLineChar = oneByte === 0x0a || oneByte === 0x0d;

    if (!newLineChar) lastLine += String.fromCharCode(oneByte);

    if (state === ParsingState.INIT && newLineDetected) {
      if (boundary === lastLine) {
        state = ParsingState.READING_HEADERS;
      } else {
        throw new Error("The first line did not match the provided boundary");
      }
      lastLine = "";
    } else if (state === ParsingState.READING_HEADERS && newLineDetected) {
      header = lastLine;
      state = ParsingState.READING_INFO;
      lastLine = "";
    } else if (state === ParsingState.READING_INFO && newLineDetected) {
      info = lastLine;
      if (info === "") {
        state = ParsingState.READING_DATA;
        lastLine = "";
      } else {
        state = ParsingState.READING_PART_SEPARATOR;
        lastLine = "";
      }
    } else if (state === ParsingState.READING_PART_SEPARATOR && newLineDetected) {
      state = ParsingState.READING_DATA;
      buffer = [];
      lastLine = "";
    } else if (state === ParsingState.READING_DATA) {
      if (lastLine.length > boundary.length + 2) lastLine = "";
      if (lastLine === boundary) {
        const j = buffer.length - lastLine.length;
        const data = buffer.slice(0, j - 1);
        allParts.push(
          processPart({ contentTypeHeader: header, contentDispositionHeader: info, data })
        );
        buffer = [];
        lastLine = "";
        state = ParsingState.POST_READING_DATA;
        header = "";
        info = "";
      } else {
        buffer.push(oneByte);
      }
      if (newLineDetected) lastLine = "";
    } else if (state === ParsingState.POST_READING_DATA) {
      if (newLineDetected) state = ParsingState.READING_HEADERS;
    }
  }
  return allParts;
}

function processPart(part: InputPart): MultipartOutputPart {
  const contentType = part.contentTypeHeader.split(":")[1].trim();
  const raw = Buffer.from(part.data);
  const output: MultipartOutputPart = {
    contentType: contentType as "application/json" | "application/octet-stream",
    data: contentType === "application/json" ? JSON.parse(raw.toString()) : raw,
  };
  if (part.contentDispositionHeader) {
    output.contentDisposition = part.contentDispositionHeader.split(":")[1].trim();
  }
  return output;
}
