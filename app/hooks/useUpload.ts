import { useEffect, useRef, useState } from "react";
import { confirmUpload, getUploadAuth } from "~/services/file";
import { useRevalidator } from "react-router";
import type { UploadFile, UploadProps } from "antd";
import { requireApiSuccess } from "~/services/http";

export interface PreviewUploadFile extends UploadFile {
  localUrl?: string;
}

const bucket = import.meta.env.VITE_BUCKET;

export default function useUpload() {
  const [fileList, setFileList] = useState<PreviewUploadFile[]>([]);
  const revalidator = useRevalidator();
  const activeUploads = useRef(new Set<AbortController>());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const uploads = activeUploads.current;
    return () => {
      uploads.forEach(controller => controller.abort());
      uploads.clear();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const scheduleListRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void revalidator.revalidate();
      refreshTimerRef.current = null;
    }, 150);
  };

  const customRequest: NonNullable<UploadProps["customRequest"]> = ({
    onSuccess,
    onError,
    file,
    onProgress,
  }) => {
    if (typeof file === "string") {
      onError?.(new Error("无法读取文件"));
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    activeUploads.current.add(controller);
    let xhr: XMLHttpRequest | null = null;
    const abortTransfer = () => xhr?.abort();
    signal.addEventListener("abort", abortTransfer, { once: true });
    void (async () => {
      try {
        const data = requireApiSuccess(
          await getUploadAuth(
            {
              fileName:
                file instanceof File || "name" in file
                  ? String(file.name)
                  : "upload.bin",
              fileSize: file.size,
              contentType: file.type,
              bucket,
            },
            signal,
          ),
        );
        signal.throwIfAborted();
        xhr = new XMLHttpRequest();
        xhr.open("PUT", data.uploadUrl);
        xhr.timeout = 120_000;
        xhr.upload.onprogress = event => {
          if (event.lengthComputable) {
            const percent = Math.floor((event.loaded / event.total) * 90);
            onProgress?.({ percent });
          }
        };
        await new Promise<void>((resolve, reject) => {
          if (!xhr) return reject(new Error("无法创建上传请求"));
          xhr.onload = () => {
            if (xhr && xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error("文件上传失败，请重试"));
          };
          xhr.onerror = () => reject(new Error("网络中断，文件未上传"));
          xhr.onabort = () => reject(new Error("上传已取消"));
          xhr.ontimeout = () => reject(new Error("上传超时，请重试"));
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream",
          );
          xhr.send(file);
        });
        signal.throwIfAborted();
        onProgress?.({ percent: 95 });
        const confirmed = requireApiSuccess(
          await confirmUpload(data.id, signal),
        );
        signal.throwIfAborted();
        if (confirmed !== true) throw new Error("服务器未确认文件，请重试");
        onSuccess?.(data.id);
        scheduleListRefresh();
      } catch (error) {
        if (signal.aborted) return;
        onError?.(
          error instanceof Error ? error : new Error("上传失败，请重试"),
        );
      } finally {
        signal.removeEventListener("abort", abortTransfer);
        activeUploads.current.delete(controller);
      }
    })();

    return {
      abort: () => controller.abort(),
    };
  };
  return {
    fileList,
    setFileList,
    customRequest,
  };
}
