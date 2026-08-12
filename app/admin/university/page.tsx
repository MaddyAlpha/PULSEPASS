import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CheckCircle, XCircle, ShieldCheck } from 'lucide-react'
import { revalidatePath } from 'next/cache'

async function approveRequest(requestId: string, userId: string, collegeId: string) {
  'use server'
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role to bypass RLS for profile update
    {
      cookies: {
        getAll() { return cookies().getAll() },
        setAll() {}
      }
    }
  )

  // 1. Update request status
  await supabase.from('role_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', requestId)
  
  // 2. Elevate user profile to organiser
  await supabase.from('profiles').update({
    role: 'organiser',
    college_id: collegeId
  }).eq('id', userId)

  revalidatePath('/admin/university')
}

async function rejectRequest(requestId: string) {
  'use server'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookies().getAll() },
        setAll() {}
      }
    }
  )

  await supabase.from('role_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', requestId)
  
  revalidatePath('/admin/university')
}

export default async function UniversityAdminPage() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookies().getAll() },
        setAll() {}
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase.from('profiles').select('university_id_fk').eq('id', user.id).single()
  
  const { data: requests } = await supabase
    .from('role_requests')
    .select(`
      *,
      profiles:user_id(full_name, email, roll_number),
      colleges:college_id(name)
    `)
    .eq('university_id', profile?.university_id_fk || '')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-cyber-green" />
          University Admin Dashboard
        </h1>
        <p className="text-white/60 mt-2">Approve or reject organiser role requests from students.</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-6">Pending Role Requests</h2>
        
        {!requests || requests.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-white/10 rounded-xl">
            <p className="text-white/40">No pending role requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-sm">
                  <th className="p-4 font-medium uppercase">Applicant</th>
                  <th className="p-4 font-medium uppercase">Roll Number</th>
                  <th className="p-4 font-medium uppercase">Target College</th>
                  <th className="p-4 font-medium uppercase">Invite Code Used</th>
                  <th className="p-4 font-medium uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req: any) => (
                  <tr key={req.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4">
                      <div>
                        <div className="font-semibold text-white">{req.profiles?.full_name}</div>
                        <div className="text-xs text-white/50">{req.profiles?.email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-sm text-cyber-green">{req.profiles?.roll_number || 'N/A'}</span>
                    </td>
                    <td className="p-4 text-white/80">{req.colleges?.name}</td>
                    <td className="p-4 font-mono text-white/60">{req.invite_code}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-3">
                        <form action={rejectRequest.bind(null, req.id)}>
                          <button type="submit" className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Reject">
                            <XCircle className="w-5 h-5" />
                          </button>
                        </form>
                        <form action={approveRequest.bind(null, req.id, req.user_id, req.college_id)}>
                          <button type="submit" className="p-2 text-white/40 hover:text-cyber-green hover:bg-cyber-green/10 rounded-lg transition-colors" title="Approve">
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
