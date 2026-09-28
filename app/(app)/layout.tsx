import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/session'
import Tabs from './Tabs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getViewer()
  if (!profile.onboarded_at) redirect('/onboarding')
  return (
    <>
      {children}
      <Tabs />
    </>
  )
}
