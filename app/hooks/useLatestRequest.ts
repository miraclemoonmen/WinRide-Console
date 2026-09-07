import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router";

/** 详情入口只接收最近一次选择的响应；关闭或离开当前页面后取消。 */
export function useLatestRequest() {
  const requestRef = useRef<AbortController | null>(null);
  const location = useLocation();
  const cancel = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  useEffect(() => cancel, [cancel, location.key]);

  const run = useCallback(
    async <T>(request: (signal: AbortSignal) => Promise<T>) => {
      cancel();
      const controller = new AbortController();
      requestRef.current = controller;
      try {
        const result = await request(controller.signal);
        return controller.signal.aborted ? undefined : result;
      } catch (error) {
        if (!controller.signal.aborted) throw error;
        return undefined;
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    },
    [cancel],
  );

  return { run, cancel };
}
