import type { BoardItem, PlanningReport } from './types'

const clean=(s:string)=>s.replace(/\s+/g,' ').trim()
const textOf=(items:BoardItem[])=>clean(items.map(item=>item.type==='note'||item.type==='text'?item.text:'').filter(Boolean).join(' · '))

export function planFromBoard(items:BoardItem[], title:string):PlanningReport{
  const source=textOf(items)
  const base=source||title||'새로운 모바일 서비스 아이디어'
  const hasGame=/게임|룰렛|퀴즈|점수|퍼즐|벌칙/.test(base)
  const hasTrack=/기록|습관|일지|건강|가계부|체크/.test(base)
  const hasAi=/ai|인공지능|추천|상담|생성|도우미/i.test(base)
  const hasSocial=/친구|공유|모임|커플|함께/.test(base)
  const mvp=hasGame?['즉시 시작','핵심 플레이','결과/재도전']:
    hasTrack?['빠른 기록','최근 기록','누적 변화']:
    hasAi?['한 줄 입력','AI 결과','결과 저장/다시 요청']:
    hasSocial?['참여자/대상 입력','핵심 공동 행동','결과 공유']:
    ['핵심 입력','핵심 처리','명확한 결과']
  const later=hasGame?['랭킹','친구 전적','상점']:hasTrack?['리마인더','주간 리포트']:['커뮤니티','고급 개인화']
  return{
    problem:'사용자가 '+base.slice(0,44)+'와 관련된 일을 더 빠르고 명확하게 처리하기 어렵다.',
    audience:hasSocial?'2명 이상이 함께 쓰는 모바일 사용자':'모바일에서 짧게 문제를 해결하려는 사용자',
    situation:hasGame?'1~10분의 짧은 여가·모임 상황':hasTrack?'하루 1회 이상 반복 기록하는 상황':'필요가 생긴 순간 30초~3분 안에 결과를 얻고 싶은 상황',
    coreValue:hasGame?'설명 없이 바로 시작하고 짧은 시간 안에 재미있는 결과를 얻는다.':hasTrack?'최소 입력으로 기록하고 변화가 쌓이는 가치를 만든다.':'몇 번의 행동만으로 원하는 결과를 얻는다.',
    mvp,
    later,
    retention:hasGame?['빠른 재도전','오늘의 변형 룰']:hasTrack?['누적 기록','주간 변화 요약']:['최근 작업 재사용','반복 작업 단축'],
    revenue:hasAi?['무료 기본 사용량','고급 기능 유료화','호출 비용 상한 설정']:['핵심 가치 검증 후 광고/결제 검토','핵심 흐름을 끊는 강제 광고는 피하기'],
    risks:['기능을 너무 많이 넣지 않기','첫 성공 경험 전에 불필요한 가입/권한 요구 금지','시장성 판단은 실제 데이터로 별도 검증']
  }
}

export function buildMasterPrompt(report:PlanningReport,title:string){
  return [
    '# M10 벼림노트 기획 핸드오프',
    '프로젝트: '+title,
    '',
    '## 문제',
    report.problem,
    '## 사용자',
    report.audience,
    '## 사용 상황',
    report.situation,
    '## 핵심 가치',
    report.coreValue,
    '## MVP',
    ...report.mvp.map((x,i)=>(i+1)+'. '+x),
    '## Later',
    ...report.later.map(x=>'- '+x),
    '## Retention',
    ...report.retention.map(x=>'- '+x),
    '## Revenue',
    ...report.revenue.map(x=>'- '+x),
    '## Risks',
    ...report.risks.map(x=>'- '+x),
    '',
    '이 기획을 기반으로 모바일 우선 제품 명세와 구현 계획을 만들고, MVP 범위를 유지한 채 실제 동작 가능한 결과물을 설계하라.'
  ].join('\n')
}
