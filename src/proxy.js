import { NextResponse } from 'next/server';
import { createClient } from '../lib/supabase/middleware';

export async function proxy(request) {
  const { supabase, response } = createClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith('/admin');
  const isCustomerRoute = pathname.startsWith('/customer');

  if (!isAdminRoute && !isCustomerRoute) return response;

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { data: roleRow } = await supabase
    .from('users_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = roleRow?.role;

  if (isAdminRoute && role !== 'admin') {
    return NextResponse.redirect(new URL('/customer/profile', request.url));
  }

  if (isCustomerRoute && role !== 'customer') {
    return NextResponse.redirect(new URL('/admin/nfc-items', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
