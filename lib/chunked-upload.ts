"use client";

export const ODIIN_CHUNK_SIZE = 5 * 1024 * 1024;

type UploadOptions = {
  headers?: Record<string, string>;
  onProgress?: (percent: number) => void;
};

type UploadedPart = { partNumber: number; etag: string };

function jsonHeaders(extra: Record<string, string> = {}) {
  return { "Content-Type": "application/json", ...extra };
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: string; uploadId?: string; ok?: boolean };
  if (!response.ok) throw new Error(data.error || `Upload request failed (${response.status}).`);
  return data;
}

function sendPart(url: string, body: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void) {
  return new Promise<UploadedPart>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.responseType = "json";
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onerror = () => reject(new Error("The connection was interrupted while transferring this video."));
    xhr.onabort = () => reject(new Error("The video upload was cancelled."));
    xhr.onload = () => {
      const data = (xhr.response || {}) as { error?: string; partNumber?: number; etag?: string };
      if (xhr.status < 200 || xhr.status >= 300 || !data.etag || !data.partNumber) {
        reject(new Error(data.error || `Video chunk failed (${xhr.status}).`));
        return;
      }
      resolve({ partNumber: data.partNumber, etag: data.etag });
    };
    xhr.send(body);
  });
}

async function retryPart(url: string, body: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await sendPart(url, body, headers, onProgress);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, attempt * 600));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Video chunk failed after three attempts.");
}

export async function uploadVideoInChunks(eventId: string, file: File, options: UploadOptions = {}) {
  const base = `/api/media/${encodeURIComponent(eventId)}`;
  const headers = options.headers ?? {};
  const totalParts = Math.ceil(file.size / ODIIN_CHUNK_SIZE);
  let uploadId = "";

  try {
    options.onProgress?.(0);
    const init = await readJson(await fetch(`${base}?action=init`, {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || "video/mp4",
        totalParts,
      }),
    }));
    if (!init.uploadId) throw new Error("Storage did not create an upload session.");
    uploadId = init.uploadId;

    const parts: UploadedPart[] = [];
    let completedBytes = 0;
    for (let index = 0; index < totalParts; index += 1) {
      const start = index * ODIIN_CHUNK_SIZE;
      const end = Math.min(start + ODIIN_CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const url = `${base}?action=part&uploadId=${encodeURIComponent(uploadId)}&partNumber=${index + 1}`;
      const part = await retryPart(url, chunk, headers, (loaded) => {
        options.onProgress?.(Math.min(99, Math.round(((completedBytes + loaded) / file.size) * 100)));
      });
      parts.push(part);
      completedBytes += chunk.size;
      options.onProgress?.(Math.min(99, Math.round((completedBytes / file.size) * 100)));
    }

    await readJson(await fetch(`${base}?action=complete`, {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({ uploadId, parts, fileSize: file.size }),
    }));

    const stored = await fetch(base, { method: "HEAD", cache: "no-store" });
    const storedSize = Number(stored.headers.get("content-length") || 0);
    if (!stored.ok || storedSize !== file.size) throw new Error("Storage verification failed; the record was retained for retry.");
    options.onProgress?.(100);
    return { ok: true, streamUrl: base };
  } catch (error) {
    if (uploadId) {
      await fetch(`${base}?action=fail`, {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ uploadId, error: error instanceof Error ? error.message : "Upload interrupted" }),
      }).catch(() => undefined);
    }
    throw error;
  }
}
