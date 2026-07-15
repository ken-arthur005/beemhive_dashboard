import { createClient } from '@/lib/supabase/server'
import { createBrowserClient } from '@supabase/ssr'

function anonClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export async function DELETE(request, { params }) {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: userError } = await anonClient().auth.getUser(token)
  if (userError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: roleData } = await supabase
    .from('users_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
