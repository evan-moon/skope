import { redirect } from 'next/navigation';
import { isLocale } from '@/app/_components/locale';

export default async function DocsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const target = isLocale(locale) ? locale : 'en';
  redirect(`/${target}/docs/getting-started`);
}
