# 번들 폰트 (주문파일 임베딩용)

화면·인쇄·주문파일이 같은 글꼴로 나오게 하려고 로컬에 번들한다.
Chromium 은 CFF/OTF 계열(Noto Sans KR·Pretendard)과 구글에서 불러온 Inter 웹폰트를
PDF 에 임베드하지 못한다 — 실측으로 확인했다. 여기 파일은 전부 TrueType(glyf) 이라 임베드된다.

- Inter (SIL OFL 1.1) — https://github.com/rsms/inter
- Spoqa Han Sans Neo (SIL OFL 1.1) — https://github.com/spoqa/spoqa-han-sans
  Noto Sans KR(본고딕) 파생이라 기존 교재의 한글 인상과 거의 같다. Subset 판(굵기당 ~500KB).
  서브셋이라 드문 한자 몇 자는 빠진다 → 스택 뒤의 Malgun Gothic 이 받는다(이것도 임베드됨).
- Pretendard (SIL OFL 1.1) — https://github.com/orioncactus/pretendard
  **주간테스트 표지(선생님 이름·날짜) 전용.** 표지 디자인(Illustrator)이 이 글꼴이라 맞췄다.
  위에 적힌 "Pretendard 는 임베드 안 됨"은 OTF(CFF) 판 얘기다 — 여기 것은 TTF(glyf) 판에서 뽑아 임베드된다.
  `Pretendard-Black-sub.ttf` = ASCII + 완성형 한글 2,350자(선생님 이름) · `Pretendard-SemiBold-sub.ttf` = 날짜 줄 글자만.
  다시 뽑기: `python scripts/build-weekly-cover.py` (표지 SVG 와 함께 만든다).
