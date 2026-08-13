export const runtime = 'edge';
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?redirect=/super-admin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    redirect('/my-passes')
  }

  return (
    <div className="min-h-[100dvh] bg-obsidian-950">
      {children}
    </div>
  )
}

