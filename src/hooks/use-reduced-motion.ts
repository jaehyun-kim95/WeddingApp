import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// OS의 "동작 줄이기(reduce motion)" 설정을 구독한다. 세그먼트 썸·스위치 등 애니메이션은
// 이 값이 true면 전환 시간을 0으로 두어 모션을 제거한다(DESIGN.md Segmented 규범).
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
