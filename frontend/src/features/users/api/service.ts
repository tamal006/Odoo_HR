// ============================================================
// User Service — Data Access Layer
// ============================================================
// This is the ONLY file you modify when connecting to your backend.
// Queries (queries.ts) and components import from here — they never change.
//
// Pick your pattern and replace the function bodies below:
//
// 1. Server Actions + ORM (Prisma / Drizzle / Supabase)
//    → Add 'use server' at the top of this file
//    → Call your ORM directly in each function
//
// 2. Route Handlers + ORM
//    → import { apiClient } from '@/lib/api-client'
//    → return apiClient<UsersResponse>('/users?...')
//    → Replace mock calls in route handlers (src/app/api/users/) with ORM
//
// 3. BFF — Route Handlers proxy to external backend (Laravel, Go, etc.)
//    → import { apiClient } from '@/lib/api-client'
//    → return apiClient<UsersResponse>('/users?...')
//    → Route handlers proxy requests to your external backend service
//
// 4. Direct external API (frontend-only, no Next.js backend)
//    → const res = await fetch('https://your-api.com/users?...')
//    → return res.json()
//
// Current: Mock (in-memory fake data for demo/prototyping)
// ============================================================

import { getEmployees } from '@/lib/api';
import type { UserFilters, UsersResponse, UserMutationPayload } from './types';

export async function getUsers(filters: UserFilters): Promise<UsersResponse> {
  const employees = await getEmployees();

  let filtered = employees;
  if (filters.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(
      (e) => e.name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s)
    );
  }
  if (filters.roles) {
    const roles = filters.roles.split('.');
    filtered = filtered.filter((e) => roles.includes(e.role));
  }

  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;

  return {
    success: true,
    time: new Date().toISOString(),
    message: 'Success',
    total_users: filtered.length,
    offset,
    limit,
    users: filtered.slice(offset, offset + limit)
  };
}

export async function createUser(data: UserMutationPayload) {
  return null;
}

export async function updateUser(id: string, data: UserMutationPayload) {
  return null;
}

export async function deleteUser(id: string) {
  return null;
}
