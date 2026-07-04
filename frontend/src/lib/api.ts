// Mock data structures and types
export type Role = 'Employee' | 'HR' | 'Admin';

export interface Employee {
  id: string;
  employeeId: string; // The company-assigned ID
  name: string;
  email: string;
  role: Role;
  department: string;
  designation: string;
  phone: string;
  address: string;
  avatarUrl: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Half-day' | 'Leave';
  checkIn: string | null; // HH:mm
  checkOut: string | null; // HH:mm
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: 'Paid' | 'Sick' | 'Unpaid';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'Pending' | 'Approved' | 'Rejected';
  remarks: string;
  adminComment: string | null;
}

export interface PayrollRecord {
  employeeId: string;
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  pfDeduction: number;
  taxDeduction: number;
  netSalary: number;
  lastUpdated: string;
}

// In-memory mock data
let mockEmployees: Employee[] = [
  {
    id: 'user_1',
    employeeId: 'EMP001',
    name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'Employee',
    department: 'Engineering',
    designation: 'Software Engineer',
    phone: '+1 555-0100',
    address: '123 Tech Lane, Silicon Valley, CA',
    avatarUrl: ''
  },
  {
    id: 'user_2',
    employeeId: 'HR001',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'HR',
    department: 'Human Resources',
    designation: 'HR Manager',
    phone: '+1 555-0200',
    address: '456 People St, Business City, NY',
    avatarUrl: ''
  }
];

let mockAttendance: AttendanceRecord[] = [
  {
    id: 'att_1',
    employeeId: 'EMP001',
    date: new Date().toISOString().split('T')[0],
    status: 'Present',
    checkIn: '09:00',
    checkOut: '17:00'
  },
  {
    id: 'att_2',
    employeeId: 'HR001',
    date: new Date().toISOString().split('T')[0],
    status: 'Present',
    checkIn: '08:45',
    checkOut: null // Still checked in
  }
];

let mockLeaves: LeaveRequest[] = [
  {
    id: 'lv_1',
    employeeId: 'EMP001',
    type: 'Paid',
    startDate: '2023-12-24',
    endDate: '2023-12-26',
    status: 'Pending',
    remarks: 'Christmas vacation',
    adminComment: null
  }
];

let mockPayroll: Record<string, PayrollRecord> = {
  EMP001: {
    employeeId: 'EMP001',
    basicSalary: 60000,
    hra: 15000,
    specialAllowance: 5000,
    pfDeduction: 3000,
    taxDeduction: 7000,
    netSalary: 70000,
    lastUpdated: new Date().toISOString()
  },
  HR001: {
    employeeId: 'HR001',
    basicSalary: 70000,
    hra: 20000,
    specialAllowance: 5000,
    pfDeduction: 4000,
    taxDeduction: 9000,
    netSalary: 82000,
    lastUpdated: new Date().toISOString()
  }
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// API Functions

export async function getEmployees(): Promise<Employee[]> {
  await delay(300);
  return [...mockEmployees];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  await delay(200);
  return mockEmployees.find((e) => e.id === id || e.employeeId === id) || null;
}

export async function getAttendance(employeeId: string): Promise<AttendanceRecord[]> {
  await delay(300);
  return mockAttendance.filter((a) => a.employeeId === employeeId);
}

export async function postCheckIn(employeeId: string): Promise<void> {
  await delay(200);
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Find if already checked in today
  const existing = mockAttendance.find((a) => a.employeeId === employeeId && a.date === date);
  if (existing) {
    if (!existing.checkOut) {
      existing.checkOut = time;
    }
  } else {
    mockAttendance.push({
      id: Math.random().toString(36).substring(7),
      employeeId,
      date,
      status: 'Present',
      checkIn: time,
      checkOut: null
    });
  }
}

export async function getLeaves(employeeId?: string): Promise<LeaveRequest[]> {
  await delay(300);
  if (employeeId) {
    return mockLeaves.filter((l) => l.employeeId === employeeId);
  }
  return [...mockLeaves]; // Admin view: get all
}

export async function postLeave(
  data: Omit<LeaveRequest, 'id' | 'status' | 'adminComment'>
): Promise<void> {
  await delay(300);
  mockLeaves.push({
    ...data,
    id: Math.random().toString(36).substring(7),
    status: 'Pending',
    adminComment: null
  });
}

export async function patchLeave(
  id: string,
  status: LeaveRequest['status'],
  comment: string
): Promise<void> {
  await delay(200);
  const leave = mockLeaves.find((l) => l.id === id);
  if (leave) {
    leave.status = status;
    leave.adminComment = comment;
  }
}

export async function getPayroll(employeeId: string): Promise<PayrollRecord | null> {
  await delay(300);
  return mockPayroll[employeeId] || null;
}

export async function patchPayroll(
  employeeId: string,
  data: Partial<PayrollRecord>
): Promise<void> {
  await delay(300);
  if (mockPayroll[employeeId]) {
    mockPayroll[employeeId] = {
      ...mockPayroll[employeeId],
      ...data,
      lastUpdated: new Date().toISOString()
    };
  } else {
    // If not exists, mock create it
    mockPayroll[employeeId] = {
      employeeId,
      basicSalary: 0,
      hra: 0,
      specialAllowance: 0,
      pfDeduction: 0,
      taxDeduction: 0,
      netSalary: 0,
      ...data,
      lastUpdated: new Date().toISOString()
    };
  }
}
