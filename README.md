# 벼림노트 · Byeorim Note

갤럭시탭 + S펜 중심의 제품 기획·스케치 PWA입니다.

## 핵심 기능
- S펜 자유 드로잉 / 형광펜 / 지우개
- Pointer Events 기반 pen / touch / mouse 분리
- S펜 필압값을 선 굵기에 반영
- 손가락 1개 이동, 2개 핀치 줌
- S펜 사용 직후 터치를 무시하는 간단한 palm rejection
- 스티키 메모, 텍스트, 사각형, 원, 연결 화살표, 모바일 와이어프레임
- 페이지 여러 장
- Undo / Redo
- localStorage 자동 저장
- JSON 백업
- PNG 내보내기
- 브라우저 인쇄를 통한 PDF 저장
- 캔버스 메모 기반 로컬 기획 엔진
- Problem / Audience / Situation / Core Value / MVP Cutter / Retention / Revenue / Risks
- 벼림 개발용 Master Prompt 복사
- PWA manifest + service worker + 192/512 앱 아이콘
- Vercel 배포 호환

## 갤럭시탭 사용
1. Vercel 등 HTTPS 주소로 배포합니다.
2. Galaxy Tab의 Chrome/Samsung Internet에서 접속합니다.
3. 상단 **앱 설치** 버튼 또는 브라우저 메뉴의 **앱 설치 / 홈 화면에 추가**를 선택합니다.
4. S펜은 드로잉, 손가락은 캔버스 이동/확대에 사용합니다.

## 로컬 실행
```bash
npm install
npm run dev
```

## 제품 빌드
```bash
npm run check
npm run build
```

## 기획 아키텍처
벼림노트는 생각을 만드는 입력 도구입니다.

```
S Pen / Sticky / Wireframe
        ↓
Local Planning Engine
        ↓
MVP / Retention / Revenue
        ↓
Master Planning Prompt
        ↓
Prompt Engine
        ↓
M10 벼림 / Apps in Toss Builder
```

현재 v1의 기획 엔진은 오프라인에서도 쓸 수 있는 규칙 기반입니다. 차기 버전에서는 Prompt Engine API/LLM 연결, 손글씨 OCR, 스케치→와이어프레임 변환, 클라우드 동기화를 추가할 수 있습니다.
