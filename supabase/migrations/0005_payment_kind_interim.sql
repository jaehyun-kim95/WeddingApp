-- 납부 종류에 '중도금(INTERIM)' 추가. 잔금(BALANCE)은 계산값으로 바뀌어 UI에서 뺐지만, enum 값은
-- 하위호환으로 남겨둔다(forward-only — 제거하지 않음). 분담은 여전히 payment.payer(ADR-0004),
-- 잔금 = 약정(기본+옵션) − Σ(완료 납부)로 계산해 표기한다(저장하지 않음).
-- 적용: Supabase SQL Editor에 1회 실행(autocommit — ADD VALUE는 트랜잭션 밖에서 안전). 0004와 동일 방식.

alter type payment_kind add value if not exists 'INTERIM';
