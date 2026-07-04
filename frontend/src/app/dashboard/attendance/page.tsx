import { AttendanceView } from '@/features/attendance/components/attendance-view';
import { currentUser } from '@clerk/nextjs/server';

export default async function AttendancePage() {
  const user = await currentUser();
  const currentEmployeeId = (user?.unsafeMetadata?.employeeId as string) || 'EMP001';
  const role = (user?.unsafeMetadata?.role as string) || 'Employee';

  return <AttendanceView employeeId={currentEmployeeId} role={role} />;
}
