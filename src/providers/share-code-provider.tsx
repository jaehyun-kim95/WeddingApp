import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useCoupleRealtime } from '@/hooks/use-couple-realtime';
import { clearShareCode, loadShareCode, saveShareCode } from '@/lib/share-code';

// 로컬에 저장된 공유 코드를 앱 전역에 제공한다(ADR-0003). 커플 데이터 접근의 열쇠.
// status: loading(저장소 확인 중) / none(코드 없음→온보딩) / ready(코드 있음).
type Status = 'loading' | 'none' | 'ready';

type ShareCodeContextValue = {
  shareCode: string | null;
  status: Status;
  save: (code: string) => Promise<void>;
  clear: () => Promise<void>;
};

const ShareCodeContext = createContext<ShareCodeContextValue | null>(null);

export function ShareCodeProvider({ children }: { children: ReactNode }) {
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    loadShareCode().then((code) => {
      setShareCode(code);
      setStatus(code ? 'ready' : 'none');
    });
  }, []);

  const save = useCallback(async (code: string) => {
    await saveShareCode(code);
    setShareCode(code);
    setStatus('ready');
  }, []);

  const clear = useCallback(async () => {
    await clearShareCode();
    setShareCode(null);
    setStatus('none');
  }, []);

  // 코드가 있는 동안 상대 기기 변경 신호를 구독한다.
  useCoupleRealtime(shareCode);

  return (
    <ShareCodeContext.Provider value={{ shareCode, status, save, clear }}>
      {children}
    </ShareCodeContext.Provider>
  );
}

export function useShareCode(): ShareCodeContextValue {
  const ctx = useContext(ShareCodeContext);
  if (!ctx) throw new Error('useShareCode는 ShareCodeProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
