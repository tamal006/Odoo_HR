import { Employee } from '@/lib/api';

export type User = Employee;

export type UserFilters = {
  page?: number;
  limit?: number;
  roles?: string;
  search?: string;
  sort?: string;
};

export type UsersResponse = {
  success: boolean;
  time: string;
  message: string;
  total_users: number;
  offset: number;
  limit: number;
  users: Employee[];
};

export type UserMutationPayload = Partial<Employee>;
