import type { Metadata } from 'next';
import Landing from '../_components/Landing';

export const metadata: Metadata = {
  title: 'skope — 당신에게 닿는 뉴스',
  description:
    '로컬 우선 개인화 뉴스 인텔리전스. 세상을 향한 렌즈 + 워처: Claude가 훑고, skope는 당신에게 경로가 있는 것(Reachability)만 남기며, 당신을 당신의 거품으로부터 지켜봅니다. MCP · SQLite · API 키 불필요.',
};

export default function KoHome() {
  return <Landing locale="ko" />;
}
