// Use Supabase's factor lifecycle; never store TOTP secrets in application storage or logs.
export async function totpFactors(client) {
  const { data, error } = await client.auth.mfa.listFactors()
  if (error) throw error
  return (data?.totp || []).filter(factor => factor.status === 'verified')
}

export async function enrollAuthenticator(client) {
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if ((userData?.user?.factors || []).some(factor => factor.status === 'verified')) {
    throw new Error('An authenticator is already enabled. Sign in with your existing factor; do not replace it here.')
  }
  // Discard only unfinished enrollments, never a verified factor. Enrollment starts on an explicit click.
  for (const factor of userData?.user?.factors || []) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      const { error } = await client.auth.mfa.unenroll({ factorId: factor.id })
      if (error) throw error
    }
  }
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', issuer: 'Beem Hive', friendlyName: 'Beem Hive admin' })
  if (error) throw error
  return data
}

export async function verifyAuthenticator(client, factorId, code) {
  if (!factorId || !/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code from your authenticator app.')
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw error
}
